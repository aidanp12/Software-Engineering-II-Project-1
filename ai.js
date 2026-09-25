/*
Project: Project 2 - Minesweeper Maintenance & Extension
File Description: AI Solver added by the incoming maintenance team.

Operates on the same grid/Tile objects built by grid.js (buildGrid / revealTile /
flagTile / getNeighborCoords), so it plays by the exact same rules a human player
does - it can only ever act on tiles it has "seen" via the grid state (isFlipped /
isFlagged / numSurroundingBombs), never on hidden tile.isBomb values.

Difficulties:
- "easy":   pure random guessing among hidden, unflagged tiles.
- "medium": easy + two deduction rules:
              1) if a revealed tile's hidden-neighbor count equals its number,
                 every hidden neighbor is a mine -> flag them.
              2) if a revealed tile's flagged-neighbor count equals its number,
                 every remaining hidden neighbor is safe -> open them.
- "hard":   medium + the 1-2-1 pattern: three side-by-side revealed tiles
            showing 1-2-1 mean the two outer hidden neighbors (in the adjacent
            row/column) are mines and the inner hidden neighbor is safe.

aiTakeTurn(grid, difficulty) performs exactly one AI turn (every deduction found
in a single pass, or one random reveal if nothing could be deduced) and returns
the same "Playing" / "Victory" / "Game Over: Loss" strings revealTile() returns,
so the UI can treat an AI turn exactly like a human turn.
*/

// All hidden (not yet flipped), unflagged tile coordinates left on the board.
function aiCollectHiddenUnflagged(grid)
{
	let cells = [];
	for (let i = 0; i < grid.length; i++)
	{
		for (let j = 0; j < grid[i].length; j++)
		{
			if (!grid[i][j].isFlipped && !grid[i][j].isFlagged)
			{
				cells.push([i, j]);
			}
		}
	}
	return cells;
}

// Easy difficulty, and the fallback for medium/hard when no rule applies.
function aiRandomMove(grid)
{
	const candidates = aiCollectHiddenUnflagged(grid);
	if (candidates.length === 0) return "Playing";
	const [x, y] = candidates[Math.floor(Math.random() * candidates.length)];
	return revealTile(grid, x, y);
}

/*
	Scans every revealed, numbered tile and applies the two Medium rules
	wherever they hold. A single pass may flag/open several tiles at once,
	matching "flag all hidden neighbors" / "open all other hidden neighbors".

	Sets changed.value = true if anything was flagged or opened.
	Returns the most recent non-"Playing" result seen, or "Playing".
*/
function aiApplyBasicRules(grid, changed)
{
	let result = "Playing";

	for (let i = 0; i < grid.length; i++)
	{
		for (let j = 0; j < grid[i].length; j++)
		{
			const tile = grid[i][j];
			if (!tile.isFlipped || tile.isBomb || tile.numSurroundingBombs === 0) continue;

			const neighbors = getNeighborCoords(i, j);
			const hidden = neighbors.filter(([x, y]) => !grid[x][y].isFlipped);
			const flagged = hidden.filter(([x, y]) => grid[x][y].isFlagged);
			const unflaggedHidden = hidden.filter(([x, y]) => !grid[x][y].isFlagged);

			if (unflaggedHidden.length === 0) continue;

			if (hidden.length === tile.numSurroundingBombs)
			{
				// Rule 1: every hidden neighbor must be a mine.
				unflaggedHidden.forEach(([x, y]) => flagTile(grid, x, y));
				changed.value = true;
			}
			else if (flagged.length === tile.numSurroundingBombs)
			{
				// Rule 2: the mines are accounted for, so the rest are safe.
				unflaggedHidden.forEach(([x, y]) => {
					const r = revealTile(grid, x, y);
					if (r !== "Playing") result = r;
				});
				changed.value = true;
			}
		}
	}

	return result;
}

/*
	Hard-only 1-2-1 rule. Looks for three revealed, non-bomb tiles in a row
	(horizontally or vertically) reading 1-2-1, then checks the row/column
	immediately next to them for a matching trio of hidden tiles: the two
	outer hidden tiles are flagged as mines, the inner one is opened as safe.
*/
function aiApply121Pattern(grid, changed)
{
	let result = "Playing";

	function isSafeTriple(a, b, c, hA, hB, hC)
	{
		if (!hA || !hB || !hC) return false;
		if (!a.isFlipped || !b.isFlipped || !c.isFlipped) return false;
		if (a.isBomb || b.isBomb || c.isBomb) return false;
		if (a.numSurroundingBombs !== 1 || b.numSurroundingBombs !== 2 || c.numSurroundingBombs !== 1) return false;
		if (hA.isFlipped || hB.isFlipped || hC.isFlipped) return false;
		return true;
	}

	function applyTriple(hA, hB, hC, ax, ay, bx, by, cx, cy)
	{
		if (!hA.isFlagged) flagTile(grid, ax, ay);
		if (!hC.isFlagged) flagTile(grid, cx, cy);
		if (!hB.isFlagged)
		{
			const r = revealTile(grid, bx, by);
			if (r !== "Playing") result = r;
		}
		changed.value = true;
	}

	// Horizontal 1-2-1 in row j, checked against the row directly above/below.
	for (let j = 0; j < grid_height; j++)
	{
		for (let i = 0; i + 2 < grid_width; i++)
		{
			const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 2][j];
			for (const dj of [-1, 1])
			{
				const jj = j + dj;
				if (jj < 0 || jj >= grid_height) continue;
				const hA = grid[i][jj], hB = grid[i + 1][jj], hC = grid[i + 2][jj];
				if (isSafeTriple(a, b, c, hA, hB, hC))
				{
					applyTriple(hA, hB, hC, i, jj, i + 1, jj, i + 2, jj);
				}
			}
		}
	}

	// Vertical 1-2-1 in column i, checked against the column directly left/right.
	for (let i = 0; i < grid_width; i++)
	{
		for (let j = 0; j + 2 < grid_height; j++)
		{
			const a = grid[i][j], b = grid[i][j + 1], c = grid[i][j + 2];
			for (const di of [-1, 1])
			{
				const ii = i + di;
				if (ii < 0 || ii >= grid_width) continue;
				const hA = grid[ii][j], hB = grid[ii][j + 1], hC = grid[ii][j + 2];
				if (isSafeTriple(a, b, c, hA, hB, hC))
				{
					applyTriple(hA, hB, hC, ii, j, ii, j + 1, ii, j + 2);
				}
			}
		}
	}

	return result;
}

/*
	Performs one full AI turn on `grid` at the given difficulty
	("easy" | "medium" | "hard"). Returns "Playing" / "Victory" / "Game Over: Loss".
*/
function aiTakeTurn(grid, difficulty)
{
	if (difficulty === "easy")
	{
		return aiRandomMove(grid);
	}

	const changed = { value: false };
	let result = aiApplyBasicRules(grid, changed);

	if (!changed.value && difficulty === "hard")
	{
		result = aiApply121Pattern(grid, changed);
	}

	if (!changed.value)
	{
		return aiRandomMove(grid);
	}
	return result;
}
