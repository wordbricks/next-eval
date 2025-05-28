import { NextResponse } from 'next/server';
import dotenv from 'dotenv';

dotenv.config(); // Ensure environment variables are loaded

export async function POST(request: Request) {
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

  if (!SLACK_WEBHOOK_URL) {
    console.error('SLACK_WEBHOOK_URL is not defined in environment variables.');
    return NextResponse.json(
      { message: 'Slack webhook URL is not configured on the server.' },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();

    if (!body.text) {
      return NextResponse.json(
        { message: 'Feedback text is missing in the request body.' },
        { status: 400 },
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
      return NextResponse.json(
        { message: 'Failed to send feedback to Slack.', error: errorText },
        { status: slackResponse.status },
      );
    }

    return NextResponse.json(
      { message: 'Feedback sent successfully.' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error processing feedback request:', error);
    let errorMessage = 'An unknown error occurred while processing the feedback request.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: 'Error processing feedback request.', error: errorMessage },
      { status: 500 },
    );
  }
}