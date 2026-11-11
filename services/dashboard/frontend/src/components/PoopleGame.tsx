import React, { useState, useCallback, useMemo } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Grid,
    CircularProgress,
    Stack,
    IconButton,
    Tooltip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip
} from '@mui/material';
import { PlayArrow as PlayIcon, Settings as SettingsIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import GameSettingsDialog, { FieldDefinition, DialogConfig } from './GameSettingsDialog';
import { PoopleResultState, GameStatus, PoopleRequest } from '../types/api';
import { resultsCardContentSx, resultsCardSx, resultsColumnSx, resultsScrollBodySx } from './puzzleResultsSx';

interface PoopleGameProps {
    gameStatus: GameStatus | null;
    isLoading: boolean;
    isSolving: boolean;
    onSolve: (gameType: string, requestData: PoopleRequest) => Promise<void>;
    onCancel: () => Promise<void>;
    onClear: () => void;
    showError: (message: string) => void;
    results: PoopleResultState | null;
    onLoadMore: (fileType: string) => Promise<void>;
}

interface PoopleConfig {
    [key: string]: string | number | boolean;
    preset: number;
    maxDepth: number;
    excludeUncommonWords: boolean;
    maxSolutions: number;
}

const PoopleResults = React.memo(({
    results,
    onCopy,
    onLoadMore,
    isLoading
}: {
    results: PoopleResultState;
    onCopy: (text: string) => void;
    onLoadMore: (fileType: string) => void;
    isLoading: boolean;
}) => {
    const solutions = results?.solutions || [];
    const gameData = results?.gameData;

    const handleCopyAll = () => {
        if (!solutions || solutions.length === 0) return;
        const text = solutions.join('\n');
        onCopy(text);
    };

    if (!solutions || (solutions.length === 0 && !gameData)) {
        return null;
    }

    const totalFound = gameData?.actualTotalFound || gameData?.totalSolutions || 0;

    return (
        <Card sx={resultsCardSx}>
            <CardContent sx={resultsCardContentSx}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                        Solutions ({solutions.length}/{totalFound})
                    </Typography>
                    {solutions.length > 0 && (
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleCopyAll}
                            startIcon={<CopyIcon />}
                        >
                            Copy All
                        </Button>
                    )}
                </Box>

                <TableContainer component={Paper} variant="outlined" sx={resultsScrollBodySx}>
                    <Table size="small" stickyHeader sx={{ minWidth: 420 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>Word Ladder</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Words</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {solutions.map((solution, index) => {
                                const words = solution.split(' ').filter(Boolean);
                                return (
                                    <TableRow
                                        key={index}
                                        hover
                                        onClick={() => onCopy(solution)}
                                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
                                                {words.map((w, wIdx) => (
                                                    <React.Fragment key={wIdx}>
                                                        <Chip
                                                            label={w.toUpperCase()}
                                                            size="small"
                                                            variant={wIdx === 0 || wIdx === words.length - 1 ? "filled" : "outlined"}
                                                            color={wIdx === 0 ? "primary" : wIdx === words.length - 1 ? "secondary" : "default"}
                                                            sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                                                        />
                                                        {wIdx < words.length - 1 && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                →
                                                            </Typography>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </Box>
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                            {words.length}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>

                {gameData && gameData.isLimited && solutions.length < totalFound && (
                    <Button
                        variant="contained"
                        onClick={() => onLoadMore('results')}
                        disabled={isLoading}
                        sx={{ mt: 2, alignSelf: 'flex-start', flexShrink: 0 }}
                        size="small"
                    >
                        Load More
                    </Button>
                )}
            </CardContent>
        </Card>
    );
});
PoopleResults.displayName = 'PoopleResults';

const PoopleGame = ({
    gameStatus,
    isLoading,
    isSolving,
    onSolve,
    onCancel,
    onClear,
    showError,
    results,
    onLoadMore
}: PoopleGameProps) => {
    const [startWord, setStartWord] = useState('');
    const [endWord, setEndWord] = useState('POOP');
    const [settingsOpen, setSettingsOpen] = useState(false);

    const [config, setConfig] = useState<PoopleConfig>({
        preset: 1,
        maxDepth: 10,
        excludeUncommonWords: true,
        maxSolutions: 1000
    });

    const settingsFields: FieldDefinition[] = useMemo(() => [
        {
            name: 'preset',
            label: 'Preset',
            type: 'select',
            options: [
                { value: 1, label: '1 - Default (Depth 10, Common words)' },
                { value: 2, label: '2 - Fast (Depth 10, First 100)' },
                { value: 3, label: '3 - Exhaustive (Depth 10, All words)' },
                { value: 0, label: '0 - Custom' }
            ]
        },
        {
            name: 'maxDepth',
            label: 'Max Depth (words)',
            type: 'number',
            min: 2,
            max: 20,
            disabled: (cfg) => cfg.preset !== 0
        },
        {
            name: 'maxSolutions',
            label: 'Max Solutions Limit',
            type: 'number',
            min: 10,
            max: 10000,
            disabled: (cfg) => cfg.preset !== 0
        },
        {
            name: 'excludeUncommonWords',
            label: 'Exclude Uncommon Words',
            type: 'checkbox'
        }
    ], []);

    const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
        setStartWord(val);
        if (val.length === 4 && (!endWord || endWord.length !== 4)) {
            setEndWord('POOP');
        }
    };

    const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
        setEndWord(val);
    };

    const handleSolve = useCallback(async () => {
        if (!startWord.trim()) {
            showError('Please enter a start word');
            return;
        }

        const effectiveEnd = endWord.trim() || (startWord.length === 4 ? 'POOP' : '');
        if (!effectiveEnd) {
            showError('Please enter a target ending word');
            return;
        }

        if (startWord.length !== effectiveEnd.length) {
            showError('Start word and target word must have the same length');
            return;
        }

        const requestData: PoopleRequest = {
            startWord: startWord.trim(),
            endWord: effectiveEnd,
            preset: config.preset,
            excludeUncommonWords: config.excludeUncommonWords,
            maxDepth: config.maxDepth,
            maxSolutions: config.maxSolutions,
            start: 0,
            end: 100
        };

        await onSolve('poople', requestData);
    }, [startWord, endWord, config, onSolve, showError]);

    const handleClear = useCallback(() => {
        setStartWord('');
        setEndWord('POOP');
        onClear();
    }, [onClear]);

    const handleCopy = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
    }, []);

    const canSolve = startWord.length > 0 && endWord.length === startWord.length && !isLoading && !isSolving && (gameStatus ? gameStatus.healthy : true);

    return (
        <Grid container spacing={2} sx={{ height: { xs: 'auto', md: '100%' }, minHeight: 0, flexGrow: 1 }}>
            {/* Input Controls */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Card sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <CardContent sx={{ p: 2, flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, '&:last-child': { pb: 2 } }}>
                        <Stack direction="row" spacing={1} sx={{ mb: 0.5 }} justifyContent="space-between" alignItems="center" flexShrink={0}>
                            <Button variant="outlined" onClick={handleClear} disabled={isLoading} size="small">
                                New Game
                            </Button>
                            <Tooltip title="Settings">
                                <IconButton onClick={() => setSettingsOpen(true)} size="small">
                                    <SettingsIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>

                        <Box sx={{ mb: 0.5, flexShrink: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Poople
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Change one letter at a time to reach the target word.
                            </Typography>
                        </Box>

                        <Stack spacing={2} sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5, pt: 1.5, minHeight: 0 }}>
                            <TextField
                                fullWidth
                                label="Start Word"
                                variant="outlined"
                                size="small"
                                value={startWord}
                                onChange={handleStartChange}
                                placeholder="E.g., COLD"
                                disabled={isLoading}
                                slotProps={{ htmlInput: { autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: 'false', style: { fontFamily: 'monospace', letterSpacing: '0.1em' } } }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && canSolve) {
                                        handleSolve();
                                    }
                                }}
                            />

                            <TextField
                                fullWidth
                                label="Target Word"
                                variant="outlined"
                                size="small"
                                value={endWord}
                                onChange={handleEndChange}
                                placeholder="E.g., POOP"
                                disabled={isLoading}
                                slotProps={{ htmlInput: { autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: 'false', style: { fontFamily: 'monospace', letterSpacing: '0.1em' } } }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && canSolve) {
                                        handleSolve();
                                    }
                                }}
                            />

                            {/* Visual Preview */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, my: 3 }}>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        px: 2,
                                        py: 1.5,
                                        fontFamily: 'monospace',
                                        fontSize: '1.25rem',
                                        fontWeight: 'bold',
                                        bgcolor: 'primary.light',
                                        color: 'primary.contrastText',
                                        borderRadius: 2
                                    }}
                                >
                                    {startWord || '????'}
                                </Paper>
                                <Typography variant="h6" color="text.secondary">
                                    → ... →
                                </Typography>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        px: 2,
                                        py: 1.5,
                                        fontFamily: 'monospace',
                                        fontSize: '1.25rem',
                                        fontWeight: 'bold',
                                        bgcolor: 'secondary.light',
                                        color: 'secondary.contrastText',
                                        borderRadius: 2
                                    }}
                                >
                                    {endWord || 'POOP'}
                                </Paper>
                            </Box>
                        </Stack>

                        <Button
                            fullWidth
                            variant="contained"
                            size="medium"
                            onClick={isSolving ? onCancel : handleSolve}
                            disabled={!isSolving && !canSolve}
                            color={isSolving ? "error" : "primary"}
                            startIcon={isSolving ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                            sx={{ mt: 1.5, flexShrink: 0 }}
                        >
                            {isSolving ? 'Cancel' : 'Solve'}
                        </Button>

                        <GameSettingsDialog
                            open={settingsOpen}
                            onClose={() => setSettingsOpen(false)}
                            onSave={(newConfig: DialogConfig) => setConfig({
                                preset: Number(newConfig.preset),
                                maxDepth: Number(newConfig.maxDepth || 10),
                                excludeUncommonWords: Boolean(newConfig.excludeUncommonWords),
                                maxSolutions: Number(newConfig.maxSolutions || 1000)
                            })}
                            title="Poople Settings"
                            config={config}
                            fields={settingsFields}
                        />
                    </CardContent>
                </Card>
            </Grid>

            {/* Results */}
            <Grid size={{ xs: 12, md: 6 }} sx={resultsColumnSx}>
                {results && results.gameData ? (
                    <PoopleResults
                        results={results}
                        onCopy={handleCopy}
                        onLoadMore={onLoadMore}
                        isLoading={isLoading}
                    />
                ) : (
                    <Card sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', alignItems: 'center', justifyContent: 'center', py: { xs: 6, md: 0 }, flexGrow: 1 }}>
                        <CardContent>
                            <Typography variant="h6" color="text.secondary" align="center">
                                Run Solver
                            </Typography>
                        </CardContent>
                    </Card>
                )}
            </Grid>
        </Grid>
    );
};

export default React.memo(PoopleGame);
