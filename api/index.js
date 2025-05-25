import serverless from 'serverless-http';
import app from '../src/server.js'; // Adjust path based on your structure

export const handler = serverless(app);