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

// Finds every tile that is still hidden and has not been flagged
function aiCollectHiddenUnflagged(grid)
{
	let cells = [];

	// Loops through every row and column in the grid
	for (let i = 0; i < grid.length; i++)
	{
		for (let j = 0; j < grid[i].length; j++)
		{
			// Only adds tiles that have not been revealed or flagged
			if (!grid[i][j].isFlipped && !grid[i][j].isFlagged)
			{
				cells.push([i, j]);
			}
		}
	}

	return cells;
}

// Chooses a random hidden tile for the AI to reveal
function aiRandomAction(grid)
{
	// Gets all tiles that can still be revealed
	const candidates = aiCollectHiddenUnflagged(grid);

	// If there are no valid tiles left, the AI cannot make a move
	if (candidates.length === 0) return null;

	// Picks one random tile from the available candidates
	const [x, y] = candidates[Math.floor(Math.random() * candidates.length)];

	return { type: "reveal", x: x, y: y };
}

// Medium difficulty rules.
// Adds tiles known to be mines into `mines` and known safe tiles into `safes`.
function aiFindBasicDeductions(grid, mines, safes)
{
	// Checks every tile on the board
	for (let i = 0; i < grid.length; i++)
	{
		for (let j = 0; j < grid[i].length; j++)
		{
			const tile = grid[i][j];

			// Only revealed numbered tiles can be used to make deductions
			if (!tile.isFlipped || tile.isBomb || tile.numSurroundingBombs === 0) continue;

			// Gets all neighboring coordinates around this tile
			const neighbors = getNeighborCoords(i, j);

			// Finds neighboring tiles that have not been revealed
			const hidden = neighbors.filter(([x, y]) => !grid[x][y].isFlipped);

			// Finds hidden tiles that are already flagged
			const flagged = hidden.filter(([x, y]) => grid[x][y].isFlagged);

			// Finds hidden tiles that have not been flagged yet
			const unflaggedHidden = hidden.filter(([x, y]) => !grid[x][y].isFlagged);

			// Bombs that have already been revealed still count toward the number
			// This is mainly used for multiplayer / points mode
			const revealedBombs = neighbors.filter(
				([x, y]) => grid[x][y].isFlipped && grid[x][y].isBomb
			).length;

			// Calculates how many bombs still need to exist around this tile
			const needed = tile.numSurroundingBombs - revealedBombs;

			// Skips the tile if there is nothing left to check
			// or if the bomb count is somehow invalid
			if (unflaggedHidden.length === 0 || needed < 0) continue;

			// If every hidden neighbor must be a bomb, mark them as mines
			if (hidden.length === needed)
			{
				unflaggedHidden.forEach((c) => mines.push(c));
			}

			// If enough bombs have already been flagged,
			// every other hidden neighboring tile must be safe
			else if (flagged.length === needed)
			{
				unflaggedHidden.forEach((c) => safes.push(c));
			}
		}
	}
}

// Hard difficulty rule.
// Looks for a horizontal or vertical revealed 1-2-1 pattern next to three hidden tiles.
function aiFind121Deductions(grid, mines, safes)
{
	// Checks whether three revealed tiles form a valid 1-2-1 pattern
	function check(a, b, c, hA, hB, hC)
	{
		// All three numbered tiles must already be revealed
		if (!a.isFlipped || !b.isFlipped || !c.isFlipped) return;

		// None of the numbered tiles can be bombs
		if (a.isBomb || b.isBomb || c.isBomb) return;

		// The revealed values must be exactly 1, 2, 1
		if (
			a.numSurroundingBombs !== 1 ||
			b.numSurroundingBombs !== 2 ||
			c.numSurroundingBombs !== 1
		) return;

		// The three tiles beside the pattern must still be hidden
		if (hA.t.isFlipped || hB.t.isFlipped || hC.t.isFlipped) return;

		// In a 1-2-1 pattern, the two outer hidden tiles are bombs
		if (!hA.t.isFlagged) mines.push([hA.x, hA.y]);
		if (!hC.t.isFlagged) mines.push([hC.x, hC.y]);

		// The hidden tile in the middle is safe
		if (!hB.t.isFlagged) safes.push([hB.x, hB.y]);
	}

	// Helper function that stores a tile along with its coordinates
	const at = (x, y) => ({ x: x, y: y, t: grid[x][y] });

	// Checks for horizontal 1-2-1 patterns
	for (let j = 0; j < grid_height; j++)
	{
		for (let i = 0; i + 2 < grid_width; i++)
		{
			// Checks the row above and below the 1-2-1 pattern
			for (const dj of [-1, 1])
			{
				const jj = j + dj;

				// Makes sure the neighboring row is still inside the board
				if (jj < 0 || jj >= grid_height) continue;

				check(
					grid[i][j],
					grid[i + 1][j],
					grid[i + 2][j],
					at(i, jj),
					at(i + 1, jj),
					at(i + 2, jj)
				);
			}
		}
	}

	// Checks for vertical 1-2-1 patterns
	for (let i = 0; i < grid_width; i++)
	{
		for (let j = 0; j + 2 < grid_height; j++)
		{
			// Checks the column to the left and right of the 1-2-1 pattern
			for (const di of [-1, 1])
			{
				const ii = i + di;

				// Makes sure the neighboring column is still inside the board
				if (ii < 0 || ii >= grid_width) continue;

				check(
					grid[i][j],
					grid[i][j + 1],
					grid[i][j + 2],
					at(ii, j),
					at(ii, j + 1),
					at(ii, j + 2)
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
	// Easy difficulty only makes random moves
	if (difficulty === "easy") return aiRandomAction(grid);

	// Stores tiles that the AI determines are mines or safe
	const mines = [];
	const safes = [];

	// Medium and hard difficulties first use the basic rules
	aiFindBasicDeductions(grid, mines, safes);

	// Hard difficulty tries the 1-2-1 rule if the basic rules found nothing
	if (difficulty === "hard" && mines.length === 0 && safes.length === 0)
	{
		aiFind121Deductions(grid, mines, safes);
	}

	// Counts how many flags are currently placed on the board
	const flagsPlaced = grid.flat().filter((t) => t.isFlagged).length;

	// Stores all possible actions the AI could take
	const options = [];

	// Only adds flag actions if the maximum number of flags has not been reached
	if (flagsPlaced < maxFlags)
	{
		mines.forEach(([x, y]) =>
			options.push({ type: "flag", x: x, y: y })
		);
	}

	// Adds all known safe tiles as possible reveal actions
	safes.forEach(([x, y]) =>
		options.push({ type: "reveal", x: x, y: y })
	);

	// If no logical move was found, fall back to a random reveal
	if (options.length === 0) return aiRandomAction(grid);

	// Randomly chooses one of the valid logical moves
	return options[Math.floor(Math.random() * options.length)];
}
