import serverless from 'serverless-http';
import app from '../src/server'; // Adjust path based on your structure

export const handler = serverless(app);