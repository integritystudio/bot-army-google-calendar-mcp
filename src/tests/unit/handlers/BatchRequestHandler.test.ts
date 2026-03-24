import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { BatchRequestHandler, BatchRequest, BatchResponse } from '../../../handlers/core/BatchRequestHandler.js';

// Constants for batch response construction
const BATCH_BOUNDARY = 'batch_abc123';

// Test data constants
const PRIMARY_EVENTS_REQUEST: BatchRequest[] = [
  {
    method: 'GET',
    path: '/calendar/v3/calendars/primary/events'
  }
];

// Helper to build mock multipart response text
function buildMockBatchResponse(
  parts: string[],
  boundary: string = BATCH_BOUNDARY
): string {
  const body = parts
    .map(part => `--${boundary}\n${part}`)
    .join('\n');
  return [
    'HTTP/1.1 200 OK',
    `Content-Type: multipart/mixed; boundary=${boundary}`,
    '',
    body,
    `--${boundary}--`
  ].join('\n');
}

// Helper to build a single response part
function buildResponsePart(
  statusLine: string,
  json: string,
  contentId: string = 'response-item1'
): string {
  return [
    'Content-Type: application/http',
    `Content-ID: <${contentId}>`,
    '',
    statusLine,
    'Content-Type: application/json',
    '',
    json
  ].join('\n');
}

// Helper to access private methods for testing
function createBatchBody(
  handler: BatchRequestHandler,
  requests: BatchRequest[]
): string {
  return (handler as unknown as { createBatchBody: (r: BatchRequest[]) => string })
    .createBatchBody(requests);
}

function getBoundary(handler: BatchRequestHandler): string {
  return (handler as unknown as { boundary: string }).boundary;
}

function parseBatchResponse(
  handler: BatchRequestHandler,
  responseText: string
): BatchResponse[] {
  return (handler as unknown as { parseBatchResponse: (r: string) => BatchResponse[] })
    .parseBatchResponse(responseText);
}

describe('BatchRequestHandler', () => {
  let mockOAuth2Client: OAuth2Client;
  let batchHandler: BatchRequestHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOAuth2Client = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'mock_access_token' })
    } as unknown as OAuth2Client;
    batchHandler = new BatchRequestHandler(mockOAuth2Client);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Batch Request Creation', () => {
    it('should create proper multipart request body with single request', () => {
      const requests: BatchRequest[] = [
        {
          method: 'GET',
          path: '/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime'
        }
      ];

      const result = createBatchBody(batchHandler, requests);
      const boundary = getBoundary(batchHandler);

      expect(result).toContain(`--${boundary}`);
      expect(result).toContain('Content-Type: application/http');
      expect(result).toContain('Content-ID: <item1>');
      expect(result).toContain('GET /calendar/v3/calendars/primary/events');
      expect(result).toContain('singleEvents=true');
      expect(result).toContain('orderBy=startTime');
      expect(result).toContain(`--${boundary}--`);
    });

    it('should create proper multipart request body with multiple requests', () => {
      const requests: BatchRequest[] = [
        {
          method: 'GET',
          path: '/calendar/v3/calendars/primary/events'
        },
        {
          method: 'GET',
          path: '/calendar/v3/calendars/work%40example.com/events'
        },
        {
          method: 'GET',
          path: '/calendar/v3/calendars/personal%40example.com/events'
        }
      ];

      const result = createBatchBody(batchHandler, requests);
      const boundary = getBoundary(batchHandler);
      const REQUEST_COUNT = 3;
      const EXPECTED_BOUNDARY_COUNT = REQUEST_COUNT + 1; // +1 for closing boundary

      expect(result).toContain('Content-ID: <item1>');
      expect(result).toContain('Content-ID: <item2>');
      expect(result).toContain('Content-ID: <item3>');
      expect(result).toContain('calendars/primary/events');
      expect(result).toContain('calendars/work%40example.com/events');
      expect(result).toContain('calendars/personal%40example.com/events');

      const boundaryCount = (result.match(new RegExp(`--${boundary}`, 'g')) || []).length;
      expect(boundaryCount).toBe(EXPECTED_BOUNDARY_COUNT);
    });

    it('should handle requests with custom headers', () => {
      const requests: BatchRequest[] = [
        {
          method: 'POST',
          path: '/calendar/v3/calendars/primary/events',
          headers: {
            'If-Match': '"etag123"',
            'X-Custom-Header': 'custom-value'
          }
        }
      ];

      const result = createBatchBody(batchHandler, requests);

      expect(result).toContain('If-Match: "etag123"');
      expect(result).toContain('X-Custom-Header: custom-value');
    });

    it('should handle requests with JSON body', () => {
      const requestBody = {
        summary: 'Test Event',
        start: { dateTime: '2024-01-15T10:00:00Z' },
        end: { dateTime: '2024-01-15T11:00:00Z' }
      };

      const requests: BatchRequest[] = [
        {
          method: 'POST',
          path: '/calendar/v3/calendars/primary/events',
          body: requestBody
        }
      ];

      const result = createBatchBody(batchHandler, requests);

      expect(result).toContain('Content-Type: application/json');
      expect(result).toContain(JSON.stringify(requestBody));
    });

    it('should encode URLs properly in batch requests', () => {
      const requests: BatchRequest[] = [
        {
          method: 'GET',
          path: '/calendar/v3/calendars/test%40example.com/events?timeMin=2024-01-01T00%3A00%3A00Z'
        }
      ];

      const result = createBatchBody(batchHandler, requests);

      expect(result).toContain('calendars/test%40example.com/events');
      expect(result).toContain('timeMin=2024-01-01T00%3A00%3A00Z');
    });
  });

  describe('Batch Response Parsing', () => {
    it('should parse successful response correctly', () => {
      const mockResponseText = buildMockBatchResponse([
        buildResponsePart(
          'HTTP/1.1 200 OK',
          JSON.stringify({
            items: [
              {
                id: 'event1',
                summary: 'Test Event',
                start: { dateTime: '2024-01-15T10:00:00Z' },
                end: { dateTime: '2024-01-15T11:00:00Z' }
              }
            ]
          })
        )
      ]);

      const responses = parseBatchResponse(batchHandler, mockResponseText);

      expect(responses).toHaveLength(1);
      expect(responses[0].statusCode).toBe(200);
      expect(responses[0].body.items).toHaveLength(1);
      expect(responses[0].body.items[0].summary).toBe('Test Event');
    });

    it('should parse multiple responses correctly', () => {
      const mockResponseText = buildMockBatchResponse([
        buildResponsePart(
          'HTTP/1.1 200 OK',
          '{"items": [{"id": "event1", "summary": "Event 1"}]}',
          'response-item1'
        ),
        buildResponsePart(
          'HTTP/1.1 200 OK',
          '{"items": [{"id": "event2", "summary": "Event 2"}]}',
          'response-item2'
        )
      ]);

      const responses = parseBatchResponse(batchHandler, mockResponseText);

      expect(responses).toHaveLength(2);
      expect(responses[0].body.items[0].summary).toBe('Event 1');
      expect(responses[1].body.items[0].summary).toBe('Event 2');
    });

    it('should handle error responses in batch', () => {
      const mockResponseText = buildMockBatchResponse([
        buildResponsePart(
          'HTTP/1.1 404 Not Found',
          JSON.stringify({
            error: {
              code: 404,
              message: 'Calendar not found'
            }
          })
        )
      ]);

      const responses = parseBatchResponse(batchHandler, mockResponseText);

      expect(responses).toHaveLength(1);
      expect(responses[0].statusCode).toBe(404);
      expect(responses[0].body.error.code).toBe(404);
      expect(responses[0].body.error.message).toBe('Calendar not found');
    });

    it('should handle mixed success and error responses', () => {
      const mockResponseText = buildMockBatchResponse([
        buildResponsePart(
          'HTTP/1.1 200 OK',
          '{"items": [{"id": "event1", "summary": "Success"}]}',
          'response-item1'
        ),
        buildResponsePart(
          'HTTP/1.1 403 Forbidden',
          JSON.stringify({
            error: {
              code: 403,
              message: 'Access denied'
            }
          }),
          'response-item2'
        )
      ]);

      const responses = parseBatchResponse(batchHandler, mockResponseText);

      expect(responses).toHaveLength(2);
      expect(responses[0].statusCode).toBe(200);
      expect(responses[0].body.items[0].summary).toBe('Success');
      expect(responses[1].statusCode).toBe(403);
      expect(responses[1].body.error.message).toBe('Access denied');
    });

    it('should handle empty response parts gracefully', () => {
      const mockResponseText = buildMockBatchResponse([
        buildResponsePart(
          'HTTP/1.1 200 OK',
          '{"items": []}'
        )
      ]);

      const responses = parseBatchResponse(batchHandler, mockResponseText);

      expect(responses).toHaveLength(1);
      expect(responses[0].statusCode).toBe(200);
      expect(responses[0].body.items).toEqual([]);
    });

    it('should handle malformed JSON gracefully', () => {
      const mockResponseText = buildMockBatchResponse([
        buildResponsePart(
          'HTTP/1.1 200 OK',
          '{invalid json here}'
        )
      ]);

      const responses = parseBatchResponse(batchHandler, mockResponseText);

      expect(responses).toHaveLength(1);
      expect(responses[0].statusCode).toBe(200);
      expect(responses[0].body).toBe('{invalid json here}');
    });
  });

  describe('Integration Tests', () => {
    it('should execute batch request with mocked fetch', async () => {
      const mockResponseText = buildMockBatchResponse([
        buildResponsePart(
          'HTTP/1.1 200 OK',
          '{"items": [{"id": "event1", "summary": "Test"}]}'
        )
      ]);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(mockResponseText)
      }));

      const responses = await batchHandler.executeBatch(PRIMARY_EVENTS_REQUEST);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/batch/calendar/v3',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock_access_token',
            'Content-Type': expect.stringContaining('multipart/mixed; boundary=')
          })
        })
      );

      expect(responses).toHaveLength(1);
      expect(responses[0].statusCode).toBe(200);
    });

    it('should handle network errors during batch execution', async () => {
      const noRetryHandler = new BatchRequestHandler(mockOAuth2Client);
      (noRetryHandler as unknown as { maxRetries: number }).maxRetries = 0;

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      await expect(noRetryHandler.executeBatch(PRIMARY_EVENTS_REQUEST))
        .rejects.toThrow('Failed to execute batch request: Network error');
    });

    it('should handle authentication errors', async () => {
      mockOAuth2Client.getAccessToken = vi.fn().mockRejectedValue(
        new Error('Authentication failed')
      );

      await expect(batchHandler.executeBatch(PRIMARY_EVENTS_REQUEST))
        .rejects.toThrow('Authentication failed');
    });
  });
}); 