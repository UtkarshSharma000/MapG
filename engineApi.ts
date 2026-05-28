import express from 'express';
import { spawn } from 'child_process';
import path from 'path';

const router = express.Router();

router.post('/calculate', express.json(), (req, res) => {
    // Spawn the local C++ engine in calculate mode
    const enginePath = path.join(process.cwd(), 'local_backend/odyssey_engine');
    const engineProcess = spawn(enginePath, ['calculate']);
    
    let output = '';
    let errorOutput = '';

    engineProcess.stdout.on('data', (data) => {
        output += data.toString();
    });

    engineProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    engineProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Engine exited with code ${code}:`, errorOutput);
            return res.status(500).json({ error: 'Engine calculation failed', stderr: errorOutput });
        }
        try {
            const result = JSON.parse(output);
            res.json(result);
        } catch (e) {
            console.error('Failed to parse engine output:', output);
            res.status(500).json({ error: 'Failed to parse engine output', raw: output });
        }
    });

    // Send the JSON payload via stdin to the C++ engine
    engineProcess.stdin.write(JSON.stringify(req.body) + '\n');
    engineProcess.stdin.end();
});

export default router;
