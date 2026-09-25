/*
Name(s): Ian Ruebelmann & Forest Denton
Creation Date: September 11th, 2026
Project: Project 1 - Minesweeping Game
File Description: This is the backend/gameplay function section. It is responsible for building a grid and providing helper
functions to give proper responses to actions taken in gameplay, providing the corresponding gamestates.
*/


// Object used to represent an individual tile in the grid
class Tile {
	constructor()
	{
		this.isFlipped = false;
    		this.isFlagged = false;
		this.isBomb = false;
		this.numSurroundingBombs = null;
	}

}

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
  	grid_height = height;
 	grid_width = width;

	for(let i = 0; i < width; i++)
	{
		grid[i] = [];
		for(let j = 0; j < height; j++)
		{
			grid[i][j] = new Tile();
		}
	}

	grid = populateBombs(grid, numBombs);
	grid = setTileNeighboringBombCounts(grid);
	// Added by Daniel Van Dalsem, initalizes the remaining tiles variable to detect victory.
	// 9/15/26
	remaining_tiles = height*width-numBombs;
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
	for(let i = 0; i < numBombs; i++)
	{
		while(true)
		{
			let x = Math.floor(Math.random() * width);
			let y = Math.floor(Math.random() * height);
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
	for(let i = 0; i < width; i++)
	{
		for(let j = 0; j < height; j++)
		{
			let numBombs = 0;
			
			// :3
			if (j-1 >= 0 && i-1 >= 0 && grid[i-1][j-1].isBomb == true) numBombs += 1;
			if (j-1 >= 0 && grid[i][j-1].isBomb == true) numBombs += 1;
			if (j-1 >= 0 && i+1 < width && grid[i+1][j-1].isBomb == true) numBombs += 1;
			if (i-1 >= 0 && grid[i-1][j].isBomb == true) numBombs += 1;
			if (i+1 < width && grid[i+1][j].isBomb == true) numBombs += 1;
			if (j+1 < height && i-1 >= 0 && grid[i-1][j+1].isBomb == true) numBombs += 1;
			if (j+1 < height && grid[i][j+1].isBomb == true) numBombs += 1;
			if (j+1 < height && i+1 < width && grid[i+1][j+1].isBomb == true) numBombs += 1;
			// I hate it
			
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
	for (let dx = -1; dx <= 1; dx++)
	{
		for (let dy = -1; dy <= 1; dy++)
		{
			if (dx === 0 && dy === 0) continue;
			let nx = x + dx;
			let ny = y + dy;
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
	if(tile.isBomb == true)
	{
		return "B";
	}
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
	for(let i = 0; i < grid.length; i++)
	{
		let nextLine = "";
		for(let j = 0; j < grid[i].length; j++)
		{
			nextLine += checkTile(grid[i][j]);
			nextLine += ","
		}
		console.log(nextLine)
	}
}



var remaining_tiles = 0 // amount of non bomb tiles unrevealed, will be initialized in the init function

// When a tile is clicked, just pass along the grid, and x/y cord as ints, and this should take care of the rest 
// It will also return the game state after revealing the tile. 
function revealTile(grid, xCord, yCord)
{
  let cur_tile = grid[xCord][yCord] 
  if (!cur_tile.isFlagged && !cur_tile.isFlipped)
  {
    if (checkTile(cur_tile) == "B"){
      return "Game Over: Loss";
    }
    if (checkTile(cur_tile) == 0)
    {
      recReveal(grid, xCord, yCord)
    }
    else
    {
      cur_tile.isFlipped = true;
      remaining_tiles -= 1; // one less non-bomb tile revealed 
    }
    // now to check gameState
    if (remaining_tiles == 0)
    {
      return "Victory";
    }
    else {
      return "Playing";
    }
  }
  return "Playing";  // tried to reveal flagged tile
}

// Flagging a tile
function flagTile(grid, xCord, yCord)
{
	// revealed tiles cannot be flagged
	if (grid[xCord][yCord].isFlipped)
	{
		return;
	}
  if (grid[xCord][yCord].isFlagged){
    grid[xCord][yCord].isFlagged = false; // flagging a flagged tile = unflagged tile
  }
  else
  {
    grid[xCord][yCord].isFlagged = true; 
  }
  return;
}

function recReveal(grid, xCord, yCord){ // mis flagged tiles that are 0 don't get revealed
  grid[xCord][yCord].isFlipped = true;
  remaining_tiles -= 1;
  // current tile is done, now to figure out edges 
  // Note: I used gemini 3.1 pro for figuring out these edges 
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      // Skip the current tile itself
      if (dx === 0 && dy === 0) continue;
      
      let checkX = xCord + dx;
      let checkY = yCord + dy;
      
      // Check if the coordinates are within the grid bounds
      if (checkX >= 0 && checkX < grid_width && 
          checkY >= 0 && checkY < grid_height) {
          
          // The tile is safe to check! 
          let neighborTile = grid[checkX][checkY];
          if (!neighborTile.isFlipped && !neighborTile.isFlagged) // ignore flipped and flagged tiles 
          {
            if (checkTile(neighborTile) == 0) // if the discovered tile needs to be recRevealed as well
            {
              recReveal(grid, checkX, checkY)
          
            }
            else
            {
              neighborTile.isFlipped = true;
              remaining_tiles -= 1;

            }
          }
      }
    }
  }
  return; // every valid spot is tested
}
