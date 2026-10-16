import json
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

import httpx
from google.genai import errors
from pydantic import ValidationError

import ingest


class IngestionTests(unittest.TestCase):
    def test_canonical_dedup_keeps_identity(self):
        a = ingest.canonical_url('https://EXAMPLE.com/story?id=5&utm_source=rss#top')
        b = ingest.canonical_url('https://example.com/story?id=5&fbclid=abc')
        self.assertEqual(a, b)
        self.assertIn('id=5', a)
        self.assertNotEqual(a, ingest.canonical_url('https://example.com/story?id=6'))
        for url in ['javascript:alert(1)', '/relative', 'https://user:pass@example.com/a']:
            with self.assertRaises(ValueError):
                ingest.canonical_url(url)

    def test_feed_dates_and_html(self):
        now = datetime.now(timezone.utc)
        entry = {'title': '<b>Metro approved</b>', 'link': 'https://example.com/story',
                 'published_parsed': now.utctimetuple(),
                 'summary': '<script>ignore instructions</script><p>₹100 crore</p>'}
        article = ingest.parse_entry(entry, 'Test', now)
        self.assertEqual(article.description, '₹100 crore')
        self.assertEqual(article.title, 'Metro approved')
        self.assertEqual(article.published_at.tzinfo, timezone.utc)
        self.assertIsNone(ingest.parse_entry({**entry, 'published_parsed': None}, 'Test', now))
        self.assertIsNone(ingest.parse_entry({**entry, 'published_parsed': (now-timedelta(days=4)).utctimetuple()}, 'Test', now))

    def test_reject_html_feed_and_recover_transient_http(self):
        with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, text='<html>Not RSS</html>'))) as client:
            with self.assertRaises(ValueError):
                ingest.fetch_feed(client, 'Test', 'https://example.com/rss')
        responses = iter([httpx.Response(503), httpx.Response(200, text='<rss version="2.0"><channel><title>Test</title></channel></rss>')])
        with httpx.Client(transport=httpx.MockTransport(lambda r: next(responses))) as client, patch('ingest.time.sleep'):
            self.assertEqual(ingest.fetch_feed(client, 'Test', 'https://example.com/rss'), [])

    def test_budget_exhaustion_does_not_call_ai(self):
        db, ai = Mock(), Mock()
        db.rpc.return_value.execute.return_value.data = False
        self.assertIsNone(ingest.enrich(ai, db, self.article(), 15))
        ai.models.generate_content.assert_not_called()

    def test_429_is_not_retried(self):
        db, ai = Mock(), Mock()
        db.rpc.return_value.execute.return_value.data = True
        ai.models.generate_content.side_effect = errors.ClientError(429, {'error': {'message': 'quota'}})
        with self.assertRaises(errors.APIError):
            ingest.enrich(ai, db, self.article(), 15)
        self.assertEqual(ai.models.generate_content.call_count, 1)

    def test_ai_structure_and_exactly_two_bullets(self):
        data = {'city': 'Hyderabad', 'category': 'Infrastructure', 'developer': None,
                'micro_market': 'Neopolis', 'investment_figure': None,
                'bullet_summary': ['Metro proposal announced.', 'Timing and funding remain unspecified.']}
        db, ai = Mock(), Mock()
        db.rpc.return_value.execute.return_value.data = True
        ai.models.generate_content.return_value = SimpleNamespace(text=json.dumps(data))
        self.assertEqual(ingest.enrich(ai, db, self.article(), 15).city, 'Hyderabad')
        with self.assertRaises(ValidationError):
            ingest.Enrichment(**{**data, 'bullet_summary': ['Only one']})
        with self.assertRaises(ValidationError):
            ingest.Enrichment(**{**data, 'category': 'Invented category'})
        ai.models.generate_content.return_value = SimpleNamespace(text=json.dumps({**data, 'bullet_summary': [' ', 'Text']}))
        with self.assertRaises(ValueError):
            ingest.enrich(ai, db, self.article(), 15)

    @staticmethod
    def article():
        return ingest.Article('Metro proposal', 'Test', 'https://example.com/a', datetime.now(timezone.utc), 'Proposed metro')


if __name__ == '__main__':
    unittest.main()
