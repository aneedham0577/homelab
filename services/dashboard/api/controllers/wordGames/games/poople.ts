import path from 'path';
import fs from 'fs';
import { sendError, sendSuccess } from '../../../utils/response';
import { Request, Response } from 'express';
import { getErrorMessage } from '../../../utils/errors';
import { WordGamesContext } from '../shared';

export async function solvePoople(ctx: WordGamesContext, req: Request, res: Response) {
    try {
        const {
            startWord,
            endWord = 'poop',
            preset = 1,
            maxDepth = 10,
            excludeUncommonWords = true,
            maxSolutions = 1000,
            start = 0,
            end = 100
        } = req.body;

        if (!req.body || typeof req.body !== 'object') {
            return sendError(res, 400, 'Invalid request body');
        }

        if (!startWord || typeof startWord !== 'string') {
            return sendError(res, 400, 'Start word is required and must be a string');
        }

        const cleanStart = startWord.trim().toLowerCase();
        let cleanEnd = typeof endWord === 'string' ? endWord.trim().toLowerCase() : '';

        if (!cleanEnd && cleanStart.length === 4) {
            cleanEnd = 'poop';
        }

        if (!cleanEnd) {
            return sendError(res, 400, 'Target word is required');
        }

        if (cleanStart.length !== cleanEnd.length) {
            return sendError(res, 400, 'Start word and target word must have the same length');
        }

        if (!/^[a-z]+$/i.test(cleanStart) || !/^[a-z]+$/i.test(cleanEnd)) {
            return sendError(res, 400, 'Words must only contain alphabetic characters');
        }

        const username = req.user?.username || 'user';
        const resultsFilename = ctx.generateResultsFilename(username, 'poople');

        // Build CLI command: poople --start <word> --end <word> [--preset N] [-o file]
        const args = [
            'poople',
            `--start ${cleanStart}`,
            `--end ${cleanEnd}`,
            `-o ${resultsFilename}`
        ];

        if (excludeUncommonWords !== undefined) {
            args.push(`--exclude-uncommon-words ${excludeUncommonWords ? 1 : 0}`);
        }

        const presetVal = parseInt(preset);
        if (presetVal >= 1 && presetVal <= 3) {
            args.push(`--preset ${presetVal}`);
        } else {
            if (maxDepth !== undefined) args.push(`--max-depth ${parseInt(maxDepth)}`);
            if (maxSolutions !== undefined) args.push(`--max-solutions ${parseInt(maxSolutions)}`);
        }

        // Specific overrides take priority
        if (req.body.maxDepth !== undefined && presetVal !== 0) {
            args.push(`--max-depth ${parseInt(maxDepth)}`);
        }

        const command = args.join(' ');
        console.log(`Executing Poople solver: ${command}`);

        const startTime = Date.now();
        const result = await ctx.executeCommand(command, username);
        const executionTime = Date.now() - startTime;

        if (!result.success) {
            console.error(`Solver execution failed for command: ${command}`, result.error);
            return sendError(res, 500, 'Solver error');
        }

        const outputLines = result.stdout.trim().split('\n');
        const totalFound = parseInt(outputLines[0]) || 0;
        const actualResultsFile = (outputLines[1] || resultsFilename).trim();

        const fullResultsPath = path.join(ctx.executableDir, actualResultsFile);
        if (!fs.existsSync(fullResultsPath)) {
            return sendError(res, 500, 'Solver executed but results file was not found');
        }

        const startIndex = parseInt(start) || 0;
        const endIndex = parseInt(end) || 100;
        const solutions = await ctx.readResultsChunkNoHeader(actualResultsFile, startIndex, endIndex);

        ctx.scheduleFileCleanup(actualResultsFile);

        const isLimited = totalFound > (endIndex - startIndex);

        return sendSuccess(res, {
            success: true,
            totalSolutions: Math.min(totalFound, endIndex - startIndex),
            actualTotalFound: totalFound,
            isLimited,
            executionTime,
            start: startIndex,
            end: endIndex,
            solutions: solutions,
            resultsFile: actualResultsFile,
            actualResultsFile: actualResultsFile,
            startWord: cleanStart,
            endWord: cleanEnd,
            timestamp: new Date().toISOString()
        });

    } catch (error: unknown) {
        console.error('Poople solve error:', error);
        return sendError(res, 500, 'Failed to solve Poople puzzle', getErrorMessage(error));
    }
}
