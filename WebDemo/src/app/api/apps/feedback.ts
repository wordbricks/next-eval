import { Hono } from 'hono';

const feedbackApp = new Hono();

feedbackApp.post('/', async (c) => {
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
  if (!SLACK_WEBHOOK_URL) {
    console.error('SLACK_WEBHOOK_URL is not defined in environment variables.');
    return c.json(
      { message: 'Slack webhook URL is not configured on the server.' },
      500,
    );
  }

  try {
    const body = await c.req.json();

    if (!body.text) {
      return c.json(
        { message: 'Feedback text is missing in the request body.' },
        400,
      );
    }

    const slackResponse = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: body.text }), // Forward the 'text' field as the Slack message
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      console.error(
        `Failed to send feedback to Slack: ${slackResponse.status} ${slackResponse.statusText}`,
        errorText,
      );
      return c.json(
        { message: 'Failed to send feedback to Slack.', error: errorText }
      );
    }

    return c.json(
      { message: 'Feedback sent successfully.' },
      200,
    );
  } catch (error) {
    console.error('Error processing feedback request:', error);
    let errorMessage =
      'An unknown error occurred while processing the feedback request.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return c.json(
      { message: 'Error processing feedback request.', error: errorMessage },
      500,
    );
  }
});

export default feedbackApp; 
