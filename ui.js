/*
Name(s): Daniel Van Dalsem, Johney Makeen, Ruben Pino Martinez, Christopher Brush
Creation Date: September 14th, 2026
Project: Project 1 - Minesweeping Game
File Description: This is the UI section, where it is responsible 
for displaying the game onto the screen, and providing the user a way to play the game

Daniel - UI Layout
Johney - UI Commenting and understanding functionality of functions created
Chris - Debugging fixes, and testing procedures
Ruben - UI presentation: looks, music, extra add ons
*/

/*
	Comments done by Johney Makeen on 09/16
	- takes the result string by revealTile() ("Game Over: Loss", "Victory" )
	- If its a loss or a win, calls lose()/win() to show the end screen and returns
	false, so render()'s click handler knows to stop redrawing the board. 
	- Otherwise, returns so the game keeps going and the board re-renders.
*/

//Coding in this section is done by Daniel Van Dalsem on 09/14 and 09/15. Coding is original. 


/*
AI USE (by RPM) — loss/win sequence, passing the grid, music stop, and restart button

How/why AI was used:
ChatGPT was used to merge the useful end-game behavior from the branch Chris worked on
with Ruben's presentation/music behavior and then debug the resulting loss
sequence.

Specific prompts entered:
1. "how do i make it cut off music"

2. "ask me questions to gauge what I'd want in the end"

3. After ChatGPT asked how the loss sequence should work, the requirements
   given were:
   "I'd say i'd want this: show the board for some time
   then fade to black, the words \"you just lost the game\" appears, and then
   restart button appears after. this is in sequence"
   The same response also specified revealing all mines, stopping music
   immediately, putting the restart button on the black screen, and keeping
   a restart button on a win.

4. "clicking on tiles does not immediately release hidden tiles, like
   sometimes it doesnt do anything, why is that"

5. "okay so now when i click on the bomb:
   - the black screen doesnt show up that I lost
   - the music did stop
   - the bomb did not get revealed
   - i was not prompted with restart button"

6. "how to make the black fade in on the game over"


Validation/revisions:
The original version supplied before these revisions was much simpler:
win_loss_continue() accepted only the result string, lose() called
resetScreen() and replaced the board with "You lose!", win() replaced it with
"You win!", and there was no restart button, no mine-reveal sequence, no music
shutdown, and no fade-to-black sequence.

The branch worked on by Chris before I merged already contained important pieces that were not generated
from scratch by ChatGPT: lose(grid) revealed the bombs, re-rendered the board,
disabled the buttons, and provided addRestartButton(). Ruben's branch already
contained the music/black-screen presentation work. ChatGPT's role here was to
help compare the two branches, combine the desired behavior, and adapt the
function interfaces so those pieces worked together.

Because the merged lose() needs the board itself, ChatGPT instructed changing
win_loss_continue(input) to win_loss_continue(input, grid), changing lose() to
lose(grid), and changing the render click-handler call from
win_loss_continue(result) to win_loss_continue(result, grid). This was not just
a style change: without the grid argument, lose(grid) reaches grid.flat() with
grid undefined. During testing, that exact mismatch produced the observed
behavior where the music stopped but the mines, black screen, and restart
button never appeared. The finalized file keeps the corrected grid parameter
through the entire call chain.

Another debugging pass found that setting bomb tiles to isFlipped = true was
not sufficient by itself. The earlier renderer only displayed
numSurroundingBombs for revealed tiles and had no branch for tile.isBomb.
ChatGPT therefore suggested adding an explicit tile.isBomb check in render()
and displaying "B". That render change is documented again at render() because
it is required for the "reveal every mine before fading" sequence to actually
be visible.

The fade itself was revised after the first implementation. ChatGPT originally
used one requestAnimationFrame(), but later recommended two nested
requestAnimationFrame() calls so the browser has a rendered frame at opacity 0
before transitioning to opacity 1. The finalized file uses that double-frame
approach and "opacity 1s ease".

The restart helper also changed after testing. ChatGPT first showed a plain
button and later explained how to add button.className = "restart-button".
When the class assignment was initially placed before const button =
document.createElement("button"), ChatGPT identified the ordering error and
moved the class assignment after button creation. The final file keeps that
correct order.

There are also two details in the finalized file that differ from earlier AI
suggestions and are intentionally documented rather than silently changed:
- An early music-stop answer suggested both currentMusic.pause() and
  currentMusic.currentTime = 0. The step-by-step version ultimately kept only
  pause(), and the finalized file still only pauses the track.
- The finalized lose() contains the opacity = "0" and transition assignment
  twice before the double requestAnimationFrame(). Those duplicate assignments
  are redundant and were not required by the AI solution, but they are
  preserved here because this documentation pass is not changing game logic.

Challenges/limitations:
The end-game behavior spans win_loss_continue(), lose(), win(),
addRestartButton(), render(), CSS, and the soundtrack state, so a problem in
one section can make the whole sequence appear broken.

AI-assisted section:
The later revisions involving currentMusic scope/use, win_loss_continue(...,
grid), lose(grid), the loss fade/timing sequence, win() restart behavior, and
addRestartButton().
*/

let currentMusic;

/*
Added by the incoming maintenance team (Project 2): shared state for the new
Game Mode / AI Solver / Multiplayer features. These are plain module-level
variables (matching the existing style of remaining_tiles/grid_height in
grid.js) rather than being threaded through every function call.
*/
let gameMode = "solo";       // "solo" | "multiplayer" | "vsai"
let aiDifficulty = "medium"; // "easy" | "medium" | "hard"
let aiAutoSolve = false;
let activePlayer = "player"; // 1 | 2 for multiplayer, "player" | "ai" for vsai
let boardLocked = false;     // true while the board should ignore clicks (AI's turn / auto-solve)
let autoSolveTimer = null;

// Stops any in-progress AI auto-solve loop (e.g. once the game ends).
function stopAutoSolve() {
	if (autoSolveTimer !== null) {
		clearInterval(autoSolveTimer);
		autoSolveTimer = null;
	}
}

// Reflects the current turn/mode in the #turn-indicator element.
function updateTurnIndicator() {
	const indicator = document.getElementById("turn-indicator");
	if (!indicator) return;

	if (gameMode === "multiplayer") {
		indicator.textContent = "Player " + activePlayer + "'s turn";
		indicator.style.display = "block";
	} else if (gameMode === "vsai" && aiAutoSolve) {
		indicator.textContent = "AI is auto-solving (" + aiDifficulty + ")...";
		indicator.style.display = "block";
	} else if (gameMode === "vsai") {
		indicator.textContent = activePlayer === "ai" ? "AI's turn (" + aiDifficulty + ")..." : "Your turn";
		indicator.style.display = "block";
	} else {
		indicator.style.display = "none";
	}
}

/*
	Handles what happens after a human move (reveal or flag): re-renders the
	board if the game is still going, then hands the turn to the next
	player/AI depending on gameMode. Centralizing this here keeps the
	multiplayer/AI turn logic out of render()'s click handlers.
*/
function finishTurn(grid, bombs, result) {
	if (!win_loss_continue(result, grid)) {
		stopAutoSolve();
		return;
	}
	render(grid, bombs, false);
	advanceTurn(grid, bombs);
}

// Switches turns for multiplayer, or triggers the AI's turn for interactive vsai mode.
function advanceTurn(grid, bombs) {
	if (gameMode === "multiplayer") {
		activePlayer = activePlayer === 1 ? 2 : 1;
		updateTurnIndicator();
		return;
	}

	if (gameMode === "vsai" && !aiAutoSolve) {
		activePlayer = "ai";
		boardLocked = true;
		updateTurnIndicator();

		setTimeout(() => {
			const aiResult = aiTakeTurn(grid, aiDifficulty);
			if (!win_loss_continue(aiResult, grid)) {
				return;
			}
			render(grid, bombs, false);
			activePlayer = "player";
			boardLocked = false;
			updateTurnIndicator();
		}, 700);
	}
}

// Drives an entire game with the AI playing every turn and no player input.
function runAutoSolve(grid, bombs) {
	boardLocked = true;
	updateTurnIndicator();

	autoSolveTimer = setInterval(() => {
		const result = aiTakeTurn(grid, aiDifficulty);
		if (!win_loss_continue(result, grid)) {
			stopAutoSolve();
			return;
		}
		render(grid, bombs, false);
	}, 500);
}

function win_loss_continue(input,grid) { //helps return the function lose and win - Johney 09/16
	if (input === "Game Over: Loss") {
		lose(grid)
		return false;
	}
	if (input === "Victory") {
		win()
		return false;
	} else {
		return true
	}
}
//Clears the board via resetScreen() and displays "you lose" in its place. - Johney 09/16
function lose(grid) {
	// Stop music immediately
	currentMusic.pause();

	// Reveal every mine
	grid.flat().forEach((tile) => {
		if (tile.isBomb) {
			tile.isFlipped = true;
		}
	});

	// Show the board with the mines revealed
	render(grid, grid.flat().filter((tile) => tile.isBomb).length, false);

	// Prevent the player from clicking anything
	const container = document.getElementById("main-container");
	container.querySelectorAll("button").forEach((button) => {
		button.disabled = true;
	});

	// Let player see the board first
	setTimeout(() => {
		const blackScreen = document.getElementById("intro-screen");

		blackScreen.innerHTML = "";
		blackScreen.style.zIndex = "8";
		blackScreen.style.display = "flex";

		blackScreen.style.opacity = "0";
		blackScreen.style.transition = "opacity 1s ease";

		blackScreen.style.flexDirection = "column";

		// Begin fade to black
		blackScreen.style.opacity = "0";
		blackScreen.style.transition = "opacity 1s ease";

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				blackScreen.style.opacity = "1";
			});
		});

		// After fade finishes, show message
		setTimeout(() => {
			const message = document.createElement("p");
			// Added: name the player/AI that hit the mine when in multiplayer or vs-AI mode
			message.textContent = lossMessage();
			blackScreen.appendChild(message);

			// Then show restart button
			setTimeout(() => {
				addRestartButton(blackScreen);
			}, 1500);

		}, 2000);

	}, 1500);
}
// Added by the incoming maintenance team: tailors the loss message to the active mode/player.
function lossMessage() {
	if (gameMode === "multiplayer") return "Player " + activePlayer + " hit a mine and lost!";
	if (gameMode === "vsai") return activePlayer === "ai" ? "The AI hit a mine!" : "you just lost the game.";
	return "you just lost the game.";
}
//same as lose(), but displays you win instead - Johney 09/16
function win() {
	let container = resetScreen();
	container.textContent = winMessage();
	addRestartButton(container);
}
// Added by the incoming maintenance team: tailors the win message to the active mode/player.
function winMessage() {
	if (gameMode === "multiplayer") return "You win! (Board cleared as a team)";
	if (gameMode === "vsai") return activePlayer === "ai" ? "The AI cleared the board!" : "You win!";
	return "You win!";
}
//restart button to have the user get back to the start screen, rather than having the user manually refresh the screen - Johney09/16
function addRestartButton(container) {
	const button = document.createElement("button");
	button.className = "restart-button";
	button.textContent = "RESTART";
	button.addEventListener("click", () => window.location.reload()); //reloads the screen, brings them back to the starting screen - Johney 09/16
	container.appendChild(button);
}

//shared helper used by both lose() and win(): clears the flag counter and the board -Johney 09/16
//then creates and returns a cleared out div for the win/loss message to go into -Johney 09/16
function resetScreen() {
	const container = document.getElementById("main-container");
	const flags_remaining = document.getElementById("container-two");
	flags_remaining.innerHTML = "";
	container.innerHTML = "";
	const currentdiv = document.createElement("div");
	currentdiv.className = "grid-column";
	container.appendChild(currentdiv);
	return currentdiv;
}
//Comments done by Johney Makeen (09/16) and Daniel Van Dalsem (09/15)
//Coding in this section is done by Daniel Van Dalsem, Ruben and Chris, on 09/14 and 09/15. Coding is original. 

/*
	- Starts a new game by building a 10x10 grid with the given bomb count.
	- Then, will render it for the first time (first run = true, enables the "first click is never bomb" )
	- This will be called from the Start Button's click handler. 

*/

function startup(bombs, options) {
	// options ({ mode, difficulty, autoSolve }) added by the incoming maintenance
	// team so the same startup() can launch solo, multiplayer, or vs-AI games.
	const opts = options || {};
	gameMode = opts.mode || "solo";
	aiDifficulty = opts.difficulty || "medium";
	aiAutoSolve = !!opts.autoSolve;
	activePlayer = gameMode === "multiplayer" ? 1 : "player";
	boardLocked = false;
	stopAutoSolve();

	console.log(bombs);
	const grid = buildGrid(10, 10, bombs); // height is 10, width is 10, and number of bombs is however many the user types (between 10-20) - Johney 09/16
	render(grid, bombs, true); //calls render, hands render 3 things: the built grid, the bombs count, and true for first run - Johney 09/16
	updateTurnIndicator();

	if (gameMode === "vsai" && aiAutoSolve) {
		runAutoSolve(grid, bombs);
	}
}
// this waits for the page load - Dainel; 09/15.
// because otherwise we try to manipulate the dom before - Dainel; 09/15.

//---------------------------------------------------------------------------------------------------------------

//Comments in this section done by Johney Makeen on 09/16
//Coding in this section is done by Daniel Van Dalsem on 09/14 and 09/15. Coding is original. 

/*
	- Wrapped in window.addEventListener("load ...") so this code only
	runs once the page's HTML is fully parsed. Without it, getElementById("main-container") would
	run before that div exists, and the script would fail immediately.
*/


/*
AI USE (by RPM)— opening sequence, soundtrack state, and volume control

How/why AI was used:
ChatGPT was used for the opening presentation/soundtrack work and later for
debugging how that soundtrack interacts with the loss sequence.

Specific prompts available in the supplied history:
1. "how do i make it cut off music"
2. "first step be more specific, lets go one step at a time"

Validation/revisions:
The global declaration "let currentMusic;" was added later during the explicit
"how do i make it cut off music" debugging conversation. Originally,
currentMusic was declared inside the load callback, so lose() could not access
it. ChatGPT instructed moving the declaration outside the callback and changing
the inner initialization from "let currentMusic = main_theme" to
"currentMusic = main_theme". The final file follows that scoped-state revision.

Challenges/limitations:
Early in prompting, AI had declared that current music was not local, which caused issues whenever it was attempted to
have music audio be determined by a click of an icon in the bottom left.

AI-assisted section:
The opening intro/start trigger, soundtrack state and track handoff, volume
toggle behavior, and the currentMusic scope revision.
*/

window.addEventListener("load", () => {

	// RPM
	// Adds the intro screen being a black screen to prompt user into beginning - Ruben 09/18
	const introScreen = document.getElementById("intro-screen");
	let gameStarted = false;

	const main_theme = new Audio("minesweeper_theme.mp3");
	const theme_minus_explosion = new Audio("minesweeper_default.mp3");

	currentMusic = main_theme;
	let musicPaused = false;

	function beginGame() {
		if (gameStarted) {
			return;
		}
		setTimeout(()=>{
			input.style.display = "block";
			button.style.display = "block";
			titlebar.style.display = "block";
			modeSelect.style.display = "flex"; // Added: reveal the game-mode controls alongside the rest
		}, 3000);

		gameStarted = true;

		introScreen.style.display = "none";

		document.body.classList.add("game-started");

		main_theme.play();

		main_theme.addEventListener("ended", () => {
			currentMusic = theme_minus_explosion;

			theme_minus_explosion.loop = true;
			theme_minus_explosion.play();
		});
	}

	const volumeButton = document.getElementById("volume-button");
	const volumeIcon = document.getElementById("volume-icon");

	volumeButton.addEventListener("click", () => {

		if (musicPaused) {
			currentMusic.play();
			volumeIcon.src = "volume_on.png";
			musicPaused = false;
		}
		else {
			currentMusic.pause();
			volumeIcon.src = "volume_off.png";
			musicPaused = true;
		}
	});

	introScreen.addEventListener("click", beginGame);
	document.addEventListener("keydown", beginGame);

	//Builds the welcome screen: Instructions text, mine-count input, and start button -Johney 09/16
	const container = document.getElementById("main-container");
	const currentdiv = document.createElement("div");
	const bonusInstuctions = document.createElement("div");
	currentdiv.className = "grid-column";
	container.appendChild(currentdiv);
	const titlebar = document.createElement("p");

	// RPM
	// changing font and text for the mime-prompt in CSS
	titlebar.className = "mine-prompt";

	const input = document.createElement("input");

	// RPM
	// creating a place holder to let user know where to type
	input.placeholder = "Type Here..."
	// creating visual changes inside of CSS
	input.className = "prompt-box";

	input.style.display = "none";

	const button = document.createElement("button");

	// RPM
	// adding code that would have the button be unable to be seen/pressed until after beginning animation
	button.style.display = "none";

	titlebar.textContent = "ENTER AMOUNT OF MINES (10-20), THEN PRESS START."


	titlebar.style.display = "none";

	button.className = "old-button";
	input.id = "bombNumber";
	input.type = "number"

	button.textContent = "START";

	/*
	Added by the incoming maintenance team (Project 2): lets the player choose
	between Solo play, local 2-Player alternating-turn multiplayer, and Player
	vs AI (with a difficulty and an optional "AI plays automatically" mode).
	*/
	const modeSelect = document.createElement("div");
	modeSelect.className = "mode-select";
	modeSelect.style.display = "none";

	let selectedMode = "solo";
	const modeOptions = [
		{ value: "solo", label: "Solo" },
		{ value: "multiplayer", label: "2 Player" },
		{ value: "vsai", label: "Vs AI" }
	];

	const aiOptions = document.createElement("div");
	aiOptions.className = "ai-options";
	aiOptions.style.display = "none";

	modeOptions.forEach((opt, idx) => {
		const optionLabel = document.createElement("label");
		optionLabel.className = "mode-option";

		const radio = document.createElement("input");
		radio.type = "radio";
		radio.name = "gamemode";
		radio.value = opt.value;
		radio.checked = idx === 0;
		radio.addEventListener("change", () => {
			selectedMode = opt.value;
			aiOptions.style.display = selectedMode === "vsai" ? "flex" : "none";
		});

		optionLabel.appendChild(radio);
		optionLabel.appendChild(document.createTextNode(opt.label));
		modeSelect.appendChild(optionLabel);
	});

	const difficultySelect = document.createElement("select");
	difficultySelect.className = "difficulty-select";
	["easy", "medium", "hard"].forEach((level) => {
		const option = document.createElement("option");
		option.value = level;
		option.textContent = level.toUpperCase();
		if (level === "medium") option.selected = true;
		difficultySelect.appendChild(option);
	});
	aiOptions.appendChild(difficultySelect);

	const autoSolveLabel = document.createElement("label");
	autoSolveLabel.className = "auto-solve-label";
	const autoSolveCheckbox = document.createElement("input");
	autoSolveCheckbox.type = "checkbox";
	autoSolveLabel.appendChild(autoSolveCheckbox);
	autoSolveLabel.appendChild(document.createTextNode(" AI plays automatically"));
	aiOptions.appendChild(autoSolveLabel);

	modeSelect.appendChild(aiOptions);

	container.appendChild(titlebar)
	container.appendChild(bonusInstuctions)
	container.appendChild(modeSelect);
	container.appendChild(input);
	container.appendChild(button);
//Only start the game if the entered mine count is between 10 and 20; - Johney 09/16
//otherwise, show an error and let the user try again - Johney 09/16
	
	/*
	AI USE (by RPM)— removing opening artwork/effects when START is pressed
	
	How/why AI was used:
	ChatGPT was used to make the presentation artwork disappear when the actual
	Minesweeper board starts.
	
	Specific prompts entered:
	1. "Now I want to make the page clipart disapear when the game starts"
	2. "It did not remove it..." followed by the selector that ended with
	   ".title-explosion .webpage_art"
	
	Validation/revisions:
	The first change added .webpage_art to the querySelectorAll() list that already
	hid the title, shadow, fire, and explosion elements. The first human attempt in the
	working file accidentally omitted the comma between ".title-explosion" and
	".webpage_art". This went unoticed and stunned me for some time as to why this wasn't behaving as it should.
	That selector means ".webpage_art inside .title-explosion",
	which did not match the standalone artwork, so the image remained visible.
	ChatGPT identified the selector mistake and the finalized file uses:
	".title, .title-shadow, .title-fire, .title-explosion, .webpage_art".

	
	Challenges/limitations:
	The bug was a CSS-selector syntax issue rather than a problem with
	element.style.display itself.

	Also, during separate merge advice, ChatGPT suggested stricter integer validation
	with Number.isInteger(Number(input.value)) and startup(Number(input.value)).
	The finalized file did NOT adopt those suggestions; it retains the earlier
	range-only check and passes input.value directly.
	
	AI-assisted section:
	The querySelectorAll() cleanup performed immediately before startup().
	*/

	button.addEventListener("click", () => {
		if(input.value>=10 && input.value<=20){
			document.querySelectorAll(
				".title, .title-shadow, .title-fire, .title-explosion, .webpage_art"
			).forEach(element => {
				element.style.display = "none";
			});
			modeSelect.style.display = "none"; // Added: hide the mode controls once the game starts
			startup(input.value, {
				mode: selectedMode,
				difficulty: difficultySelect.value,
				autoSolve: autoSolveCheckbox.checked
			});
		}
		else{
			bonusInstuctions.className = "out-of-range-message"
			bonusInstuctions.textContent = "Please select between 10-20 mines.";

		}
	});
});
//---------------------------------------------------------------------------------------------------------------

//Comments done by Johney Makeen on 09/16
//Coding in this section is done by Daniel Van Dalsem on 09/14 and 09/15. Coding is original. 

/*
	- to help out with labeling the grid's column, we decided to do the Java script switch cases.
	- this function will convert a column index (0-9) to a letter (A-J) for the row labels. Although, visually, the letters are placed in the column.  
	- Render will grab this function, and then preform so. 

*/
function numtoLetter(num) {
	switch (num) {
		case 0:
			return "A";
		case 1:
			return "B";
		case 2:
			return "C";
		case 3:
			return "D";
		case 4:
			return "E";
		case 5:
			return "F";
		case 6:
			return "G";
		case 7:
			return "H";
		case 8:
			return "I";
		case 9:
			return "J";
	}
}
/*
	- Draws/redrews the entire baord based on the current grid state. Called once from
	startup() to build the initial board, then called again after every click (see the handlers below)
	since this rebuilds all tiles from scratch each time rather than updating just the one tile that changed.
	- Johney 09/16 
*/

//Coding in this section is done by Daniel Van Dalsem, Ruben and Chris, on 09/14 and 09/15. Coding is original. 

/*
AI USE (by RPM) — render() revisions for visible bombs, flag limiting, and flag counter

How/why AI was used:
ChatGPT was used to debug bomb visibility after a loss and to help transfer
the tested branch's flag-limit behavior into the finalized UI.

Specific prompts entered:
1. "okay so now when i click on the bomb:
   - the black screen doesnt show up that I lost
   - the music did stop
   - the bomb did not get revealed
   - i was not prompted with restart button"

2. "So a behavior on branch called \"tested' i want to implement is the Flag
   count, ensuring that the flag is limited to 10 and user knows how many
   flags there is. ... Point to me where he does this..."

3. "So walk me step by step in my ui.js to fix that"

4. "What I want to do is this:
   ---------------------------
   |   Flag-Icon  | Number  |
   |--------------------------
   I know that somewhere we have a icon that we use for tha flag, lets do that"

5. "cool, show me how to reposition it somewhere else on the screen"

Validation/revisions:
The bomb-display change was added specifically because the new lose(grid)
function marked bomb tiles as flipped and re-rendered the board, but the
pre-change renderer had no instructions for displaying a revealed bomb. It
only displayed tile.numSurroundingBombs. ChatGPT diagnosed that mismatch and
suggested an explicit tile.isBomb branch with button.textContent = "B". The
finalized renderer contains that branch, which is what makes the mine-reveal
portion of the loss sequence visible.

Challenges/limitations:
render() rebuilds the board after interactions, so the flag count is recomputed
each render rather than stored as a separate persistent counter.

Also, one merge recommendation from ChatGPT was NOT adopted in the finalized file:
during conflict review, ChatGPT recommended keeping tested's first-click mine
relocation improvements, including a stricter nonbombs filter and
setTileNeighboringBombCounts(grid). The finalized file still uses the earlier
filter "grid.flat(2).filter((tiler) => !tiler.isBomb)" and does not call
setTileNeighboringBombCounts(grid).

AI-assisted section:
The later tile.isBomb display branch, integration of the tested flag-limit
condition, and conversion of the existing text flag counter into the
flag-icon/number counter.
*/

function render(grid, bombs, first_run) {
	// All nessesary to reviel to win - Daniel 09/15
	const container = document.getElementById("main-container");
	container.innerHTML = ""; //this will wipe the previous board, before rebuilding it - Johney 09/16
	let flags = 0; //flags counter - Johney 09/16
	for (let i = 0; i < grid.length; i++) { //iterating through the grid - Johney 09/16
		const currentdiv = document.createElement("div");
		currentdiv.className = "grid-column";
		container.appendChild(currentdiv);
		for (let x = 0; x < grid[i].length; x++) {
			const tile = grid[i][x];
			const button = document.createElement("button");
			currentdiv.appendChild(button);
			button.className = "button";
			//hidden tiles will be shown as gray, with a flag emoji if its flagged - Johney 09/16
			//revealed tiles show white with the surrounding-bomb count -Johney 09/16
			if (!tile.isFlipped) {
				button.classList.add("hidden-tile");
				if (tile.isFlagged) {
					button.textContent = "🚩";
					flags += 1;
				}
				} else {
					button.classList.add("revealed-tile");

					if (tile.isBomb) {
						button.textContent = "B";
					}
					else if (tile.numSurroundingBombs !== undefined) {
						button.textContent = tile.numSurroundingBombs;

						if (tile.numSurroundingBombs === 0) {
							button.classList.add("tile-zero");
						}
						else if (tile.numSurroundingBombs === 1) {
							button.classList.add("tile-one");
						}
						else if (tile.numSurroundingBombs === 2) {
							button.classList.add("tile-two");
						}
						else if (tile.numSurroundingBombs === 3) {
							button.classList.add("tile-three");
						}
					}
				}

			button.addEventListener("click", () => {
				if (boardLocked) return; // Added: ignore clicks during the AI's turn / auto-solve

				// if this is the first click and we have clicked on a bomb - Daniel 09/15
				if(first_run && tile.isBomb == true){
					// if this is a mine get a list of all non mine cells that are not this cell - Daniel 09/15
					let nonbombs = grid.flat(2).filter((tiler) => !tiler.isBomb);
					// disable the mine - Daniel 09/15
					tile.isBomb = false;
					// set one of the non mine cells to a mine cell - Daniel 09/15
					nonbombs[Math.floor(Math.random() * (nonbombs.length-0)-0)].isBomb = true;
					// Bug fix (incoming maintenance team): relocating the mine invalidated every
					// tile's cached numSurroundingBombs, so the numbers shown on the board could
					// be wrong for the rest of the game. Recompute them before revealing anything.
					setTileNeighboringBombCounts(grid);
				}
				const result = revealTile(grid, i, x); //Only redraw if the game is still in progress; otherwise leave the win/loss screen (set by win_loss_continue) up - Johney 09/16

				finishTurn(grid, bombs, result); // Added: also advances multiplayer/AI turns
			});
			button.addEventListener("contextmenu", (e) => {
				// prevent the right click menu from actually opening - Daniel 09/15
				e.preventDefault();
				if (boardLocked) return; // Added: ignore clicks during the AI's turn / auto-solve

				if (!tile.isFlipped && (!tile.isFlagged && flags < bombs || tile.isFlagged)) {
					flagTile(grid, i, x);
					finishTurn(grid, bombs, "Playing"); // Added: flagging also passes the turn
				}
			});
		}
		//Row letter label (A-J) from numtoLetter() - variablle is named "column" - Johney 09/16
		//even though it labels a row (see numtoLetter's comment) - Johney 09/16
		const column = document.createElement("div");
		column.className = "icon-thing letter-stack";
		column.textContent = numtoLetter(i);
		currentdiv.appendChild(column);
	}
	// Column number labels (1-10) in their own role below the board - Johney 09/16
	// is named "row" even though it labels columns - Johney 09/16
	const currentdiv = document.createElement("div");
	currentdiv.className = "grid-column";
	container.appendChild(currentdiv);
	for (let x = 0; x < grid[0].length; x++) {
		const row = document.createElement("div");
		row.className = "icon-thing";
		row.textContent = x + 1;
		currentdiv.appendChild(row);
	}
	// Displays flags remaining: total bombs minus flags currently placed - Johney 09/16
	const containertwo = document.getElementById("container-two");
	containertwo.innerHTML = "";


	
	const flagCounter = document.createElement("div");
	flagCounter.className = "flag-counter";

	const flagIcon = document.createElement("span");
	flagIcon.textContent = "🚩";

	const flagNumber = document.createElement("span");
	const diff = bombs - flags;
	flagNumber.textContent = diff;

	flagCounter.appendChild(flagIcon);
	flagCounter.appendChild(flagNumber);

	containertwo.appendChild(flagCounter);

}