/**
 * Board.tsx — 3×3 Tic-Tac-Toe game board.
 *
 * Features:
 *  - Hover glow effect (disabled when not player's turn)
 *  - Smooth cell-fill animation on placement (CSS keyframe)
 *  - Winning cells highlighted with win-flash animation
 *  - X = neon cyan, O = neon purple
 *  - Fully accessible — keyboard navigable
 */

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CellValue } from "../hooks/useGame";

interface Props {
    board: CellValue[];
    onCellClick: (index: number) => void;
    disabled: boolean;
    /** Optional: winning cell indices to highlight */
    winningCells?: number[];
}

const WINNING_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

function findWinningCells(board: CellValue[]): number[] {
    for (const [a, b, c] of WINNING_LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return [a, b, c];
        }
    }
    return [];
}

const CellSymbol: React.FC<{ value: CellValue }> = ({ value }) => {
    if (!value) return null;

    if (value === "X") {
        return (
            <motion.svg
                key="X"
                initial={{ scale: 0, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                viewBox="0 0 40 40"
                className="w-1/2 h-1/2"
                aria-label="X"
            >
                <line
                    x1="6" y1="6" x2="34" y2="34"
                    stroke="#00e5ff"
                    strokeWidth="5"
                    strokeLinecap="round"
                    filter="url(#glow-cyan)"
                />
                <line
                    x1="34" y1="6" x2="6" y2="34"
                    stroke="#00e5ff"
                    strokeWidth="5"
                    strokeLinecap="round"
                    filter="url(#glow-cyan)"
                />
                <defs>
                    <filter id="glow-cyan">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            </motion.svg>
        );
    }

    return (
        <motion.svg
            key="O"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            viewBox="0 0 40 40"
            className="w-1/2 h-1/2"
            aria-label="O"
        >
            <circle
                cx="20" cy="20" r="13"
                fill="none"
                stroke="#a855f7"
                strokeWidth="5"
                strokeLinecap="round"
                filter="url(#glow-purple)"
            />
            <defs>
                <filter id="glow-purple">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
        </motion.svg>
    );
};

export const Board: React.FC<Props> = ({
    board,
    onCellClick,
    disabled,
    winningCells: winningCellsProp,
}) => {
    const winningCells = useMemo(
        () => winningCellsProp ?? findWinningCells(board),
        [board, winningCellsProp]
    );

    const isWinningCell = (index: number) => winningCells.includes(index);

    return (
        <div
            className="grid grid-cols-3 gap-3 w-full max-w-xs sm:max-w-sm mx-auto"
            role="grid"
            aria-label="Tic-Tac-Toe board"
        >
            {board.map((cell, index) => {
                const isWinner = isWinningCell(index);
                const isEmpty = cell === null;
                const isClickable = !disabled && isEmpty && !isWinner;

                return (
                    <button
                        key={index}
                        id={`cell-${index}`}
                        role="gridcell"
                        aria-label={
                            cell ? `Cell ${index + 1}: ${cell}` : `Cell ${index + 1}: empty`
                        }
                        onClick={() => isClickable && onCellClick(index)}
                        disabled={!isClickable}
                        data-disabled={!isClickable}
                        data-winner={isWinner}
                        className={`
              relative aspect-square flex items-center justify-center
              rounded-xl border transition-all duration-150
              ${isWinner
                                ? "border-neon-cyan/60 bg-neon-cyan/10 animate-win-flash shadow-glow-cyan"
                                : isEmpty && !disabled
                                    ? "bg-dark-elevated border-dark-border/60 hover:bg-dark-border/30 hover:border-neon-cyan/30 hover:shadow-glow-sm-cyan cursor-pointer"
                                    : "bg-dark-elevated border-dark-border/60 cursor-default"
                            }
            `}
                    >
                        <AnimatePresence>
                            {cell && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <CellSymbol value={cell} />
                                </div>
                            )}
                        </AnimatePresence>
                    </button>
                );
            })}
        </div>
    );
};
