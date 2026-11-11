import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Divider
} from '@mui/material';
import { PlayArrow as PlayIcon, Settings as SettingsIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import { PoopleResultState, GameStatus, PoopleRequest } from '../types/api';
import { resultsCardContentSx, resultsCardSx, resultsColumnSx, resultsScrollBodySx } from './puzzleResultsSx';
import ExcludedWordsInput from './ExcludedWordsInput';
import { getGameExcludedWords, saveGameExcludedWords } from '../utils/gameExcludedWords';

interface PresetConfig {
    minWords: number;
    maxWords: number;
    maxSolutions: number;
}

interface GameConfig extends PresetConfig {
    preset: number;
    excludeUncommonWords: boolean;
}

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

    const [config, setConfig] = useState<GameConfig>({
        preset: 1,
        minWords: 2,
        maxWords: 10,
        maxSolutions: 1000,
        excludeUncommonWords: true
    });
    const [tempConfig, setTempConfig] = useState<GameConfig>(config);
    const [excludedWords, setExcludedWords] = useState<string[]>([]);
    const [tempExcludedWords, setTempExcludedWords] = useState<string[]>([]);

    useEffect(() => {
        getGameExcludedWords('poople').then((words) => {
            setExcludedWords(words);
            setTempExcludedWords(words);
        });
    }, []);

    // Preset configurations matching Letter Boxed pattern
    const presetConfigs = useMemo<Record<number, PresetConfig>>(() => ({
        1: { minWords: 2, maxWords: 10, maxSolutions: 1000 },
        2: { minWords: 2, maxWords: 10, maxSolutions: 100 },
        3: { minWords: 2, maxWords: 10, maxSolutions: 1000 }
    }), []);

    const getCurrentConfig = useCallback((): GameConfig => {
        if (config.preset === 0) {
            return config;
        }
        return {
            ...presetConfigs[config.preset],
            preset: config.preset,
            excludeUncommonWords: config.excludeUncommonWords
        };
    }, [config, presetConfigs]);

    const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
        setStartWord(val);
        if (val.length === 4 && (!endWord || endWord.length !== 4)) {
            setEndWord('POOP');
        }
    }, [endWord]);

    const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
        setEndWord(val);
    }, []);

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

        const currentConfig = getCurrentConfig();
        const requestData: PoopleRequest = {
            startWord: startWord.trim(),
            endWord: effectiveEnd,
            preset: config.preset,
            excludeUncommonWords: config.excludeUncommonWords,
            excludeWords: excludedWords.length > 0 ? excludedWords : undefined,
            minWords: currentConfig.minWords,
            maxWords: currentConfig.maxWords,
            maxSolutions: currentConfig.maxSolutions,
            start: 0,
            end: 100
        };

        await onSolve('poople', requestData);
    }, [startWord, endWord, config, excludedWords, getCurrentConfig, onSolve, showError]);

    const handleClear = useCallback(() => {
        setStartWord('');
        setEndWord('POOP');
        onClear();
    }, [onClear]);

    const handleCopy = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
    }, []);

    const isCustom = tempConfig.preset === 0;
    const tempConfigRecord = tempConfig as unknown as Record<string, unknown>;

    const handleOpenSettings = () => {
        setTempConfig(config);
        setTempExcludedWords(excludedWords);
        setSettingsOpen(true);
    };

    const handleTempConfigChange = (field: keyof GameConfig, value: number | boolean | string) => {
        setTempConfig(prev => ({
            ...prev,
            [field]: value
        } as unknown as GameConfig));
    };

    const handlePresetChange = (preset: number) => {
        if (preset === 0) {
            setTempConfig(prev => ({
                ...prev,
                preset: 0
            }));
        } else {
            const pConfig = presetConfigs[preset];
            setTempConfig(prev => ({
                ...prev,
                preset,
                ...pConfig
            }));
        }
    };

    const handleSaveSettings = () => {
        const finalConfig = { ...tempConfig };
        if (finalConfig.preset === 0) {
            let minW = parseInt(String(finalConfig.minWords), 10);
            if (isNaN(minW) || minW < 2) minW = config.minWords || 2;
            else if (minW > 20) minW = 20;

            let maxW = parseInt(String(finalConfig.maxWords), 10);
            if (isNaN(maxW) || maxW < 2) maxW = config.maxWords || 10;
            else if (maxW > 20) maxW = 20;

            if (minW > maxW) {
                const tmp = minW;
                minW = maxW;
                maxW = tmp;
            }

            finalConfig.minWords = minW;
            finalConfig.maxWords = maxW;

            let maxS = parseInt(String(finalConfig.maxSolutions), 10);
            if (isNaN(maxS) || maxS < 10) maxS = config.maxSolutions || 1000;
            else if (maxS > 10000) maxS = 10000;
            finalConfig.maxSolutions = maxS;
        }
        setConfig(finalConfig);
        setExcludedWords(tempExcludedWords);
        saveGameExcludedWords('poople', tempExcludedWords);
        setSettingsOpen(false);
    };

    const canSolve = startWord.length > 0 &&
                     endWord.length === startWord.length &&
                     !isLoading &&
                     !isSolving &&
                     (gameStatus ? gameStatus.healthy : true);

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
                                <IconButton onClick={handleOpenSettings} size="small">
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

                        {/* Settings Dialog matching Letter Boxed pattern */}
                        <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="xs" fullWidth>
                            <DialogTitle>Poople Settings</DialogTitle>
                            <DialogContent>
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Solver Preset</InputLabel>
                                        <Select
                                            value={tempConfig.preset}
                                            label="Solver Preset"
                                            onChange={(e) => handlePresetChange(Number(e.target.value))}
                                        >
                                            <MenuItem value={1}>1: Default (Depth 10, Common words)</MenuItem>
                                            <MenuItem value={2}>2: Fast (Depth 10, First 100)</MenuItem>
                                            <MenuItem value={3}>3: Exhaustive (Depth 10, All words)</MenuItem>
                                            <MenuItem value={0}>Custom</MenuItem>
                                        </Select>
                                    </FormControl>

                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={tempConfig.excludeUncommonWords}
                                                onChange={(e) => handleTempConfigChange('excludeUncommonWords', e.target.checked)}
                                            />
                                        }
                                        label="Exclude Uncommon Words"
                                    />

                                    <ExcludedWordsInput
                                        words={tempExcludedWords}
                                        onChange={setTempExcludedWords}
                                    />

                                    <Divider />

                                    <Box>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Custom Settings {!isCustom && '(read-only)'}
                                        </Typography>

                                        <Grid container spacing={1.5}>
                                            <Grid size={6}>
                                                <TextField
                                                    label="Min Words"
                                                    type="number"
                                                    size="small"
                                                    value={tempConfigRecord.minWords === undefined || tempConfigRecord.minWords === '' ? '' : (tempConfigRecord.minWords as number)}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === '') {
                                                            handleTempConfigChange('minWords', '');
                                                        } else {
                                                            const num = parseInt(val, 10);
                                                            if (!isNaN(num)) {
                                                                handleTempConfigChange('minWords', num);
                                                            }
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        let num = parseInt(String(tempConfig.minWords), 10);
                                                        if (isNaN(num)) {
                                                            num = config.minWords || 2;
                                                        } else {
                                                            num = Math.max(2, Math.min(20, num));
                                                        }
                                                        handleTempConfigChange('minWords', num);
                                                    }}
                                                    fullWidth
                                                    disabled={!isCustom}
                                                    slotProps={{ htmlInput: { min: 2, max: 20 } }}
                                                />
                                            </Grid>
                                            <Grid size={6}>
                                                <TextField
                                                    label="Max Words"
                                                    type="number"
                                                    size="small"
                                                    value={tempConfigRecord.maxWords === undefined || tempConfigRecord.maxWords === '' ? '' : (tempConfigRecord.maxWords as number)}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === '') {
                                                            handleTempConfigChange('maxWords', '');
                                                        } else {
                                                            const num = parseInt(val, 10);
                                                            if (!isNaN(num)) {
                                                                handleTempConfigChange('maxWords', num);
                                                            }
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        let num = parseInt(String(tempConfig.maxWords), 10);
                                                        if (isNaN(num)) {
                                                            num = config.maxWords || 10;
                                                        } else {
                                                            num = Math.max(2, Math.min(20, num));
                                                        }
                                                        handleTempConfigChange('maxWords', num);
                                                    }}
                                                    fullWidth
                                                    disabled={!isCustom}
                                                    slotProps={{ htmlInput: { min: 2, max: 20 } }}
                                                />
                                            </Grid>
                                            <Grid size={12}>
                                                <TextField
                                                    label="Max Solutions Limit"
                                                    type="number"
                                                    size="small"
                                                    value={tempConfigRecord.maxSolutions === undefined || tempConfigRecord.maxSolutions === '' ? '' : (tempConfigRecord.maxSolutions as number)}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === '') {
                                                            handleTempConfigChange('maxSolutions', '');
                                                        } else {
                                                            const num = parseInt(val, 10);
                                                            if (!isNaN(num)) {
                                                                handleTempConfigChange('maxSolutions', num);
                                                            }
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        let num = parseInt(String(tempConfig.maxSolutions), 10);
                                                        if (isNaN(num)) {
                                                            num = config.maxSolutions || 1000;
                                                        } else {
                                                            num = Math.max(10, Math.min(10000, num));
                                                        }
                                                        handleTempConfigChange('maxSolutions', num);
                                                    }}
                                                    fullWidth
                                                    disabled={!isCustom}
                                                    slotProps={{ htmlInput: { min: 10, max: 10000 } }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Stack>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
                                <Button onClick={handleSaveSettings} variant="contained">Save</Button>
                            </DialogActions>
                        </Dialog>
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
