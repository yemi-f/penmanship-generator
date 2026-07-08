export type SSEEvent = { event: string; data: string };

/**
 * Parses a text/event-stream Response body. Native EventSource can't attach
 * an Authorization header, so the app streams via fetch + apiFetch instead
 * and parses the wire format manually.
 */
export async function* parseSSE(response: Response): AsyncGenerator<SSEEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let event = "message";
      const dataLines: string[] = [];
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length > 0) {
        yield { event, data: dataLines.join("\n") };
      }

      boundary = buffer.indexOf("\n\n");
    }
  }
}
