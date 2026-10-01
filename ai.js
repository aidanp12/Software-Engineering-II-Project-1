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
	const width = grid.length;
	const height = grid[0].length;

	function neighborsOf(x, y)
	{
		const neighbors = [];

		for (let dx = -1; dx <= 1; dx++)
		{
			for (let dy = -1; dy <= 1; dy++)
			{
				if (dx === 0 && dy === 0) continue;

				const nx = x + dx;
				const ny = y + dy;

				if (nx >= 0 && nx < width && ny >= 0 && ny < height)
				{
					neighbors.push([nx, ny]);
				}
			}
		}

		return neighbors;
	}

	function sameCells(actual, expected)
	{
		if (actual.length !== expected.length) return false;

		return expected.every(([ex, ey]) =>
			actual.some(([ax, ay]) => ax === ex && ay === ey)
		);
	}

	function check(aPos, bPos, cPos, hA, hB, hC)
	{
		const [ax, ay] = aPos;
		const [bx, by] = bPos;
		const [cx, cy] = cPos;

		const a = grid[ax][ay];
		const b = grid[bx][by];
		const c = grid[cx][cy];

		if (!a.isFlipped || !b.isFlipped || !c.isFlipped) return;
		if (a.isBomb || b.isBomb || c.isBomb) return;

		if (
			a.numSurroundingBombs !== 1 ||
			b.numSurroundingBombs !== 2 ||
			c.numSurroundingBombs !== 1
		) return;

		function unresolvedAndNeeded(x, y)
		{
			const neighbors = neighborsOf(x, y);

			const knownMines = neighbors.filter(([nx, ny]) => {
				const t = grid[nx][ny];
				return t.isFlagged || (t.isFlipped && t.isBomb);
			}).length;

			const unresolved = neighbors.filter(([nx, ny]) => {
				const t = grid[nx][ny];
				return !t.isFlipped && !t.isFlagged;
			});

			return {
				unresolved,
				needed: grid[x][y].numSurroundingBombs - knownMines
			};
		}

		const A = unresolvedAndNeeded(ax, ay);
		const B = unresolvedAndNeeded(bx, by);
		const C = unresolvedAndNeeded(cx, cy);

		// A valid 1-2-1 must reduce exactly to:
		//
		// A sees hA, hB and needs 1 mine
		// B sees hA, hB, hC and needs 2 mines
		// C sees hB, hC and needs 1 mine

		if (A.needed !== 1 || B.needed !== 2 || C.needed !== 1) return;

		if (!sameCells(A.unresolved, [hA, hB])) return;
		if (!sameCells(B.unresolved, [hA, hB, hC])) return;
		if (!sameCells(C.unresolved, [hB, hC])) return;

		mines.push(hA);
		safes.push(hB);
		mines.push(hC);
	}

	// Horizontal 1-2-1
	for (let y = 0; y < height; y++)
	{
		for (let x = 0; x + 2 < width; x++)
		{
			for (const dy of [-1, 1])
			{
				const hiddenY = y + dy;
				if (hiddenY < 0 || hiddenY >= height) continue;

				check(
					[x, y],
					[x + 1, y],
					[x + 2, y],
					[x, hiddenY],
					[x + 1, hiddenY],
					[x + 2, hiddenY]
				);
			}
		}
	}

	// Vertical 1-2-1
	for (let x = 0; x < width; x++)
	{
		for (let y = 0; y + 2 < height; y++)
		{
			for (const dx of [-1, 1])
			{
				const hiddenX = x + dx;
				if (hiddenX < 0 || hiddenX >= width) continue;

				check(
					[x, y],
					[x, y + 1],
					[x, y + 2],
					[hiddenX, y],
					[hiddenX, y + 1],
					[hiddenX, y + 2]
				);
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

