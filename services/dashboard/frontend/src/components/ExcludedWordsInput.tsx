import React, { useState } from 'react';
import { Box, Chip, TextField, Typography } from '@mui/material';

interface ExcludedWordsInputProps {
    words: string[];
    onChange: (words: string[]) => void;
    label?: string;
    helperText?: string;
}

export const ExcludedWordsInput: React.FC<ExcludedWordsInputProps> = ({
    words,
    onChange,
    label = 'Excluded Words',
    helperText = 'Type words to exclude and press Enter or comma'
}) => {
    const [inputValue, setInputValue] = useState('');

    const addWord = (val: string) => {
        const cleaned = val.trim().toLowerCase();
        if (cleaned && /^[a-z]+$/.test(cleaned) && !words.includes(cleaned)) {
            onChange([...words, cleaned]);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addWord(inputValue);
            setInputValue('');
        } else if (e.key === 'Backspace' && !inputValue && words.length > 0) {
            onChange(words.slice(0, words.length - 1));
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text');
        if (text && (text.includes(',') || text.includes(' ') || text.includes('\n'))) {
            e.preventDefault();
            const tokens = text.split(/[\s,;]+/).map((t) => t.trim().toLowerCase()).filter((t) => /^[a-z]+$/.test(t));
            if (tokens.length > 0) {
                const combined = Array.from(new Set([...words, ...tokens]));
                onChange(combined);
            }
        }
    };

    const handleDelete = (wordToDelete: string) => {
        onChange(words.filter((w) => w !== wordToDelete));
    };

    return (
        <Box sx={{ mt: 1.5, mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                {label}
            </Typography>
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.75,
                    alignItems: 'center',
                    p: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    backgroundColor: 'background.paper',
                    minHeight: 48
                }}
            >
                {words.map((word) => (
                    <Chip
                        key={word}
                        label={word}
                        size="small"
                        onDelete={() => handleDelete(word)}
                        color="secondary"
                        variant="outlined"
                    />
                ))}
                <TextField
                    variant="standard"
                    size="small"
                    placeholder={words.length === 0 ? 'e.g. adze, aa, qat' : 'Add another...'}
                    value={inputValue}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val.endsWith(',') || val.endsWith(' ')) {
                            addWord(val.slice(0, -1));
                            setInputValue('');
                        } else {
                            setInputValue(val);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onBlur={() => {
                        if (inputValue.trim()) {
                            addWord(inputValue);
                            setInputValue('');
                        }
                    }}
                    InputProps={{
                        disableUnderline: true
                    }}
                    sx={{ flexGrow: 1, minWidth: 120 }}
                />
            </Box>
            {helperText && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {helperText}
                </Typography>
            )}
        </Box>
    );
};

export default ExcludedWordsInput;
