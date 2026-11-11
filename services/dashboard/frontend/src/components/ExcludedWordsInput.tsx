import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, Typography } from '@mui/material';

interface ExcludedWordsInputProps {
    words: string[];
    onChange: (words: string[]) => void;
    label?: string;
    helperText?: string;
    rows?: number;
}

export const ExcludedWordsInput: React.FC<ExcludedWordsInputProps> = ({
    words,
    onChange,
    label = 'Excluded Words',
    helperText = 'One word per line. Case-insensitive.',
    rows = 5
}) => {
    const [text, setText] = useState(() => words.join('\n'));
    const isEditingRef = useRef(false);

    // Only update from parent props if not currently being actively edited by the user
    useEffect(() => {
        if (!isEditingRef.current) {
            setText(words.join('\n'));
        }
    }, [words]);

    const syncToParent = (raw: string) => {
        const lines = raw.split('\n');
        const parsed = lines
            .map((line) => line.trim().toLowerCase())
            .filter((line) => line.length > 0 && /^[a-z]+$/.test(line));
        onChange(parsed);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        isEditingRef.current = true;
        const val = e.target.value;
        setText(val);
        syncToParent(val);
    };

    return (
        <Box sx={{ mt: 1.5, mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                {label}
            </Typography>
            <TextField
                multiline
                rows={rows}
                fullWidth
                size="small"
                placeholder={'e.g.\nadze\naa\nqat'}
                value={text}
                onChange={handleChange}
                onFocus={() => {
                    isEditingRef.current = true;
                }}
                onBlur={() => {
                    isEditingRef.current = false;
                    syncToParent(text);
                }}
                helperText={helperText}
                slotProps={{
                    htmlInput: {
                        style: {
                            fontFamily: 'monospace',
                            fontSize: '0.875rem'
                        },
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: 'false'
                    }
                }}
            />
        </Box>
    );
};

export default ExcludedWordsInput;
