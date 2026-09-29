/*
Project: Project 2 - Minesweeper Maintenance & Extension
File Description: AI Solver added by the incoming maintenance team.

The AI only reads what a human could see (isFlipped / isFlagged / numSurroundingBombs
and already-revealed bombs), never hidden tile.isBomb values. It does not change the
grid itself: aiChooseAction() returns exactly ONE action and the UI performs it.

Action shape: { type: "flag" | "reveal", x, y }, or null if nothing can be done.

Difficulties:
- "easy":   random reveal of a hidden, unflagged tile.
- "medium": easy + two deductions (all-hidden-are-mines -> flag, flags-satisfied -> reveal).
- "hard":   medium + the 1-2-1 pattern (outer hidden tiles are mines, inner is safe).
If no deduction applies, the AI falls back to a random reveal.
*/

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

function aiRandomAction(grid)
{
	const candidates = aiCollectHiddenUnflagged(grid);
	if (candidates.length === 0) return null;
	const [x, y] = candidates[Math.floor(Math.random() * candidates.length)];
	return { type: "reveal", x: x, y: y };
}

// Medium rules: pushes deduced mine coords into `mines` and deduced safe coords into `safes`.
function aiFindBasicDeductions(grid, mines, safes)
{
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
			// Bombs already uncovered (multiplayer points mode) still count toward the number.
			const revealedBombs = neighbors.filter(([x, y]) => grid[x][y].isFlipped && grid[x][y].isBomb).length;
			const needed = tile.numSurroundingBombs - revealedBombs;

			if (unflaggedHidden.length === 0 || needed < 0) continue;

			if (hidden.length === needed)
			{
				unflaggedHidden.forEach((c) => mines.push(c));
			}
			else if (flagged.length === needed)
			{
				unflaggedHidden.forEach((c) => safes.push(c));
			}
		}
	}
}

// Hard rule: horizontal or vertical revealed 1-2-1 with a fully hidden triple alongside it.
function aiFind121Deductions(grid, mines, safes)
{
	function check(a, b, c, hA, hB, hC)
	{
		if (!a.isFlipped || !b.isFlipped || !c.isFlipped) return;
		if (a.isBomb || b.isBomb || c.isBomb) return;
		if (a.numSurroundingBombs !== 1 || b.numSurroundingBombs !== 2 || c.numSurroundingBombs !== 1) return;
		if (hA.t.isFlipped || hB.t.isFlipped || hC.t.isFlipped) return;
		if (!hA.t.isFlagged) mines.push([hA.x, hA.y]);
		if (!hC.t.isFlagged) mines.push([hC.x, hC.y]);
		if (!hB.t.isFlagged) safes.push([hB.x, hB.y]);
	}
	const at = (x, y) => ({ x: x, y: y, t: grid[x][y] });

	for (let j = 0; j < grid_height; j++)
	{
		for (let i = 0; i + 2 < grid_width; i++)
		{
			for (const dj of [-1, 1])
			{
				const jj = j + dj;
				if (jj < 0 || jj >= grid_height) continue;
				check(grid[i][j], grid[i + 1][j], grid[i + 2][j], at(i, jj), at(i + 1, jj), at(i + 2, jj));
			}
		}
	}
	for (let i = 0; i < grid_width; i++)
	{
		for (let j = 0; j + 2 < grid_height; j++)
		{
			for (const di of [-1, 1])
			{
				const ii = i + di;
				if (ii < 0 || ii >= grid_width) continue;
				check(grid[i][j], grid[i][j + 1], grid[i][j + 2], at(ii, j), at(ii, j + 1), at(ii, j + 2));
			}
		}
	}
}

/*
	Picks a single action for the AI.
	inputs: grid, difficulty ("easy" | "medium" | "hard"), maxFlags (int, total mines)
	outputs: { type, x, y } or null
*/
function aiChooseAction(grid, difficulty, maxFlags)
{
	if (difficulty === "easy") return aiRandomAction(grid);

	const mines = [];
	const safes = [];
	aiFindBasicDeductions(grid, mines, safes);
	if (difficulty === "hard" && mines.length === 0 && safes.length === 0)
	{
		aiFind121Deductions(grid, mines, safes);
	}

	const flagsPlaced = grid.flat().filter((t) => t.isFlagged).length;
	const options = [];
	if (flagsPlaced < maxFlags)
	{
		mines.forEach(([x, y]) => options.push({ type: "flag", x: x, y: y }));
	}
	safes.forEach(([x, y]) => options.push({ type: "reveal", x: x, y: y }));

	if (options.length === 0) return aiRandomAction(grid);
	return options[Math.floor(Math.random() * options.length)];
}
