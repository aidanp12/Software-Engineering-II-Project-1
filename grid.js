/*
Name(s): Ian Ruebelmann & Forest Denton
Creation Date: September 11th, 2026
Project: Project 1 - Minesweeping Game
File Description: This is the backend/gameplay function section. It is responsible for building a grid and providing helper
functions to give proper responses to actions taken in gameplay, providing the corresponding gamestates.
*/

// Object used to represent an individual tile in the grid
class Tile
{
	constructor()
	{
		// Tracks whether the tile has been revealed
		this.isFlipped = false;

		// Tracks whether the tile currently has a flag placed on it
		this.isFlagged = false;

		// Stores which player placed the flag in multiplayer mode
		// null is used when there is no owner / in solo mode
		this.flagOwner = null;

		// Determines whether this tile contains a bomb
		this.isBomb = false;

		// Stores the number of bombs surrounding this tile
		this.numSurroundingBombs = null;
	}
}


// Stores the current grid dimensions so other functions can perform bounds checking
let grid_height = 0;
let grid_width = 0;


/*
	Grid setup, to be called once at the start of a game

	inputs: grid height (int), grid width (int), number of bombs (int)
	outputs: grid (2d array)

	Ian R : 9/14/26 10:21 AM
*/
function buildGrid(height, width, numBombs)
{
	let grid = [];

	// Saves the grid dimensions for later use
	grid_height = height;
	grid_width = width;

	// Creates a two-dimensional array of Tile objects
	for(let i = 0; i < width; i++)
	{
		grid[i] = [];

		for(let j = 0; j < height; j++)
		{
			grid[i][j] = new Tile();
		}
	}

	// Randomly places the requested number of bombs
	grid = populateBombs(grid, numBombs);

	// Calculates the number of neighboring bombs for every tile
	grid = setTileNeighboringBombCounts(grid);

	// Added by Daniel Van Dalsem, initializes the remaining tiles variable
	// to detect when every safe tile has been revealed
	// 9/15/26
	remaining_tiles = height * width - numBombs;

	return grid;
}


/*
	Places the specified number of bombs randomly throughout the grid (ran once during buildGrid)

	inputs: grid (2d array), number of bombs (int)
	outputs: grid (2d array)

	Ian R : 9/14/26 10:21 AM
*/

function populateBombs(grid, numBombs)
{
	let width = grid[0].length;
	let height = grid.length;

	// Repeats until the requested number of bombs has been placed
	for(let i = 0; i < numBombs; i++)
	{
		while(true)
		{
			// Chooses a random coordinate in the grid
			let x = Math.floor(Math.random() * width);
			let y = Math.floor(Math.random() * height);

			// Only places a bomb if this tile does not already contain one
			if(grid[x][y].isBomb == false)
			{
				grid[x][y].isBomb = true;
				break;
			}
		}
	}

	return grid;
}


/*
	gets the number of bombs around each tile and saves that value (ran once during buildGrid)

	inputs: grid (2d array)
	outputs: grid (2d array)

	9/14/26 10:21 AM
	Ian R
*/
function setTileNeighboringBombCounts(grid)
{
	let width = grid[0].length;
	let height = grid.length;

	// Checks every tile in the grid
	for(let i = 0; i < width; i++)
	{
		for(let j = 0; j < height; j++)
		{
			let numBombs = 0;

			// Checks all eight possible neighboring positions.
			// Each bounds check prevents accessing outside of the grid.
			if (j-1 >= 0 && i-1 >= 0 && grid[i-1][j-1].isBomb == true) numBombs += 1;
			if (j-1 >= 0 && grid[i][j-1].isBomb == true) numBombs += 1;
			if (j-1 >= 0 && i+1 < width && grid[i+1][j-1].isBomb == true) numBombs += 1;
			if (i-1 >= 0 && grid[i-1][j].isBomb == true) numBombs += 1;
			if (i+1 < width && grid[i+1][j].isBomb == true) numBombs += 1;
			if (j+1 < height && i-1 >= 0 && grid[i-1][j+1].isBomb == true) numBombs += 1;
			if (j+1 < height && grid[i][j+1].isBomb == true) numBombs += 1;
			if (j+1 < height && i+1 < width && grid[i+1][j+1].isBomb == true) numBombs += 1;

			// Stores the final neighboring bomb count in the tile
			grid[i][j].numSurroundingBombs = numBombs;
		}
	}

	return grid;
}


/*
	Returns the in-bounds [x, y] coordinate pairs surrounding (x, y). Added by the
	incoming maintenance team so the AI solver (ai.js) can inspect a revealed tile's
	neighbors without duplicating the bounds-checking logic already used above.

	inputs: x (int), y (int)
	outputs: array of [x, y] coordinate pairs
*/
function getNeighborCoords(x, y)
{
	let neighbors = [];

	// Checks every possible offset around the current tile
	for (let dx = -1; dx <= 1; dx++)
	{
		for (let dy = -1; dy <= 1; dy++)
		{
			// Skips the current tile itself
			if (dx === 0 && dy === 0) continue;

			let nx = x + dx;
			let ny = y + dy;

			// Only adds coordinates that are inside the grid
			if (nx >= 0 && nx < grid_width && ny >= 0 && ny < grid_height)
			{
				neighbors.push([nx, ny]);
			}
		}
	}

	return neighbors;
}


/*
	Simple function that will return B if a tile is a bomb and the # of surrounding bombs if not

	inputs: tile (tile)
	outputs: tile state (char)

	Ian R : 9/14/26 10:21 AM
*/
function checkTile(tile)
{
	// Bomb tiles return "B"
	if(tile.isBomb == true)
	{
		return "B";
	}

	// Safe tiles return the number of surrounding bombs
	else
	{
		return tile.numSurroundingBombs;
	}
}


/*
	Function for printing/testing grid generation

	inputs: grid (2d array)
	outputs: IO

	9/14/26 10:21 AM
	Ian R
*/
function printGrid(grid)
{
	// Builds and prints one row of the grid at a time
	for(let i = 0; i < grid.length; i++)
	{
		let nextLine = "";

		for(let j = 0; j < grid[i].length; j++)
		{
			// Adds the bomb or neighboring bomb count to the output
			nextLine += checkTile(grid[i][j]);
			nextLine += ",";
		}

		console.log(nextLine);
	}
}


// Tracks the number of non-bomb tiles that have not been revealed yet
// This value is initialized when buildGrid is called
var remaining_tiles = 0;


// Reveals a tile after it has been clicked
// Returns the current game state after the reveal
function revealTile(grid, xCord, yCord)
{
	let cur_tile = grid[xCord][yCord];

	// Only hidden, unflagged tiles can be revealed
	if (!cur_tile.isFlagged && !cur_tile.isFlipped)
	{
		// Revealing a bomb immediately ends the game
		if (checkTile(cur_tile) == "B")
		{
			return "Game Over: Loss";
		}

		// A tile with no neighboring bombs begins the recursive reveal process
		if (checkTile(cur_tile) == 0)
		{
			recReveal(grid, xCord, yCord);
		}

		// Numbered tiles are revealed normally
		else
		{
			cur_tile.isFlipped = true;

			// One fewer safe tile remains unrevealed
			remaining_tiles -= 1;
		}

		// If no safe tiles remain, the player has won
		if (remaining_tiles == 0)
		{
			return "Victory";
		}

		return "Playing";
	}

	// Clicking an already revealed or flagged tile does not change the game state
	return "Playing";
}


// Adds or removes a flag from a tile
function flagTile(grid, xCord, yCord, owner = null)
{
	// Revealed tiles cannot be flagged
	if (grid[xCord][yCord].isFlipped)
	{
		return;
	}

	// Flagging an already flagged tile removes the flag
	if (grid[xCord][yCord].isFlagged)
	{
		grid[xCord][yCord].isFlagged = false;
		grid[xCord][yCord].flagOwner = null;
	}

	// Otherwise, place a new flag and store its owner
	else
	{
		grid[xCord][yCord].isFlagged = true;
		grid[xCord][yCord].flagOwner = owner;
	}

	return;
}


// Recursively reveals connected empty tiles and the numbered tiles surrounding them
function recReveal(grid, xCord, yCord)
{
	// Reveals the current zero tile
	grid[xCord][yCord].isFlipped = true;

	// One fewer safe tile remains hidden
	remaining_tiles -= 1;

	// Checks all eight neighboring positions around the current tile
	for (let dx = -1; dx <= 1; dx++)
	{
		for (let dy = -1; dy <= 1; dy++)
		{
			// Skip the current tile itself
			if (dx === 0 && dy === 0) continue;

			let checkX = xCord + dx;
			let checkY = yCord + dy;

			// Makes sure the neighboring coordinates are inside the grid
			if (
				checkX >= 0 && checkX < grid_width &&
				checkY >= 0 && checkY < grid_height
			)
			{
				let neighborTile = grid[checkX][checkY];

				// Already revealed and flagged tiles are ignored
				if (!neighborTile.isFlipped && !neighborTile.isFlagged)
				{
					// Another zero tile continues the recursive reveal
					if (checkTile(neighborTile) == 0)
					{
						recReveal(grid, checkX, checkY);
					}

					// Numbered neighboring tiles are revealed without recursion
					else
					{
						neighborTile.isFlipped = true;
						remaining_tiles -= 1;
					}
				}
			}
		}
	}

	return;
}
