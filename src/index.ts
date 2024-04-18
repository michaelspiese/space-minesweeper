import * as paper from 'paper';

class Game 
{
    // Width and height are defined in project coordinates
    // This is different than screen coordinates!
    private width : number;
    private height : number;

    // An array of directions to translate lasers that have been shot
    private laserDir: paper.Point[];

    // The number of stars can be changed with this variable
    private numStars : number;

    // Handles capturing mouse direction and object speed based on mouse
    private mouseVector : paper.Point;
    private mouseSensetivity : number;

    // Containers for symbols accessed in multiple functions
    private mineSymbol! : paper.SymbolDefinition;
    private laserSymbol! : paper.SymbolDefinition;
    private explosionSymbol! : paper.SymbolDefinition;

    // TypeScript will throw an error if you define a type but don't initialize in the constructor
    // This can be prevented by including undefined as a second possible type
    private ship : paper.Group | undefined;
    private stars : paper.Group | undefined;
    private mines : paper.Group | undefined;
    private lasers : paper.Group | undefined;
    private explosions : paper.Group | undefined;
    
    constructor()
    {
        paper.setup('canvas');
        this.width = 1200;
        this.height = 800;
        this.mouseVector = new paper.Point(0, 0);
        this.numStars = 150;
        this.mouseSensetivity = 4;
        this.laserDir = [];
    }

    start() : void 
    {
        this.createScene();
        this.resize();

        // This registers the event handlers for window and mouse events
        paper.view.onResize = () => {this.resize();};
        paper.view.onMouseMove = (event: paper.MouseEvent) => {this.onMouseMove(event);};
        paper.view.onMouseDown = (event: paper.MouseEvent) => {this.onMouseDown(event);};
        paper.view.onFrame = (event: GameEvent) => {this.update(event);};

    }

    private createScene() : void 
    {
        // Create a new group to hold the ship, star, mine, laser, and explosion graphics
        this.ship = new paper.Group();
        this.stars = new paper.Group();
        this.mines = new paper.Group();
        this.lasers = new paper.Group();
        this.explosions = new paper.Group();

        // This line prevents the transformation matrix from being baked directly into its children
        // Instead, will be applied every frame
        this.ship.applyMatrix = false;

        // This code block loads an SVG file asynchronously
        // It uses an arrow function to specify the code that gets executed after the file is loaded
        // We will go over this syntax in class
        paper.project.importSVG('./assets/ship.svg', (item: paper.Item) => {
            // The exclamation point tells TypeScript you are certain the variable has been defined
            item.addTo(this.ship!);
            this.ship!.scale(3);
            this.ship!.position.x = this.width / 2;
            this.ship!.position.y = this.height / 2;
        });

        // Creating a symbol out of a simple circle path
        let starPath = new paper.Path.Circle(new paper.Point(0, 0), 2);
        starPath.fillColor = new paper.Color('white');
        var starSymbol = new paper.SymbolDefinition(starPath);

        // Create specified number of stars and give them a random scale and position
        for (var i = 0; i < this.numStars; i++) 
        {
            let placed = starSymbol.place(this.pointRandom(this.width, this.height));
            placed.addTo(this.stars);
            placed.scale(Math.random());
        }

        // Importing the mine graphic
        paper.project.importSVG('./assets/mine.svg', (item: paper.Item) => {
            // Defining a symbol from the mine vector graphic
            item.scale(4);
            this.mineSymbol = new paper.SymbolDefinition(item);
            
            // Function definition for placing a mine somewhere off-screen
            let spawnMine = () => {
                let placed = this.mineSymbol!.place(this.pointOOB());
                placed.addTo(this.mines!);
            }

            // Every 750ms, call spawnMine to place a mine
            setInterval(spawnMine, 750);
        });

        // Creating laser symbol definition
        let laserRec = new paper.Rectangle(new paper.Point(0, 0), new paper.Size(25, 3));
        let laserPath = new paper.Path.Rectangle(laserRec, new paper.Size(3,3));
        laserPath.fillColor = new paper.Color("green");
        laserPath.strokeColor = new paper.Color("white");
        laserPath.strokeWidth = 0.25;
        this.laserSymbol = new paper.SymbolDefinition(laserPath);

        // Creating explosion symbol definition
        let explosionPath = new paper.Path.Circle(new paper.Point(0, 0), 1);
        explosionPath.fillColor = new paper.Color("red");
        this.explosionSymbol = new paper.SymbolDefinition(explosionPath);

        // Bringingthe ship to the front of the canvas so nothing passes in front of it
        this.ship!.bringToFront();
    }

    // This method will be called once per frame
    private update(event: GameEvent) : void
    {

        // Handles parallax star movement
        for (var i = 0; i<this.stars!.children.length; i++) 
        {
            let curStar = this.stars!.children[i]

            // Move the stars with the mouse, scaled to star size
            // The value of 0.001 is an arbitrary value chosen to slow movement down
            curStar.translate(this.mouseVector.multiply(-0.001 * this.mouseSensetivity * curStar.bounds.width));

            // Wrap star movement in the x direction
            curStar.position.x = curStar.position.x % this.width;
            if (curStar.position.x < 0)
                curStar.position.x = this.width;
                
            // Wrap star movement in the y direction
            curStar.position.y = curStar.position.y % this.height;
            if (curStar.position.y < 0) 
                curStar.position.y = this.height;
        }

        // Handleing mine movement
        for (var i=0; i<this.mines!.children.length; i++) 
        {
            let curMine = this.mines!.children[i];

            // Home mines toward ship 
            let towardShip = paper.view.center.subtract(curMine.position).normalize(3);
            curMine.translate(towardShip);

            // Mines translate backwards when ship is "moving"
            curMine.translate(this.mouseVector.multiply(-0.006 * this.mouseSensetivity));

            // Apply small rotation to mines each frame
            curMine.rotate(1);

            // Mines explode when they touch the ship instead of each other like in the example game
            if (curMine.hitTest(this.ship!.position, {fill:true, tolerance:30})) 
                this.removeMine(curMine);
        }

        // Handling laser movement
        for (var i=0; i<this.lasers!.children.length; i++) 
        {
            let curLaser = this.lasers!.children[i];

            // The laser moves in the direction it was created in
            curLaser.translate(this.laserDir![i]);

            // The laser and its associated direction are removed when it goes off the screen
            if (curLaser.position.x < 0 || curLaser.position.x > this.width || curLaser.position.y < 0 || curLaser.position.y > this.height) 
            {
                curLaser.remove();
                this.laserDir!.splice(i, 1);
            }
            
            // Testing if any current laser has intersected with any of the mines
            for (var j=0; j<this.mines!.children.length; j++) 
            {
                let hit = curLaser.hitTest(this.mines!.children[j].position, {fill:true, tolerance:30});

                // If a hit has been detected explode the mine, remove the laser, and splice out the laser's direction from the array
                if (hit) 
                {
                    this.removeMine(this.mines!.children[j])
                    curLaser.remove();
                    this.laserDir!.splice(i, 1);
                }
            }
        }

        // Handles explosion animation
        for (var i=0; i<this.explosions!.children.length; i++) 
        {
            let curExplosion = this.explosions!.children[i];

            // Rapidly expand each explosion
            curExplosion.scale(1.3);

            // When the explosion exceeds some width, remove it
            if (curExplosion.bounds.width > 100)
                curExplosion.remove();
        }
        
        // Removes the oldest mine if the number of mines exceeds some value
        // An explosion is also generated
        if (this.mines!.children.length > 30)
            this.removeMine(this.mines!.children[0]);
    }

    // This handles dynamic resizing of the browser window
    // You do not need to modify this function
    private resize() : void
    {
        var aspectRatio = this.width / this.height;
        var newAspectRatio = paper.view.viewSize.width / paper.view.viewSize.height;
        if(newAspectRatio > aspectRatio)
            paper.view.zoom = paper.view.viewSize.width  / this.width;    
        else
            paper.view.zoom = paper.view.viewSize.height / this.height;
        
        paper.view.center = new paper.Point(this.width / 2, this.height / 2);
        
    }

    private onMouseMove(event: paper.MouseEvent) : void
    {
        // Get the vector from the center of the screen to the mouse position
        this.mouseVector = event.point.subtract(paper.view.center);

        // Point the ship towards the mouse cursor by converting the vector to an angle
        // This only works if applyMatrix is set to false
        this.ship!.rotation = this.mouseVector.angle + 90;
    }

    private onMouseDown(event: paper.MouseEvent) : void
    {
        // Place a new laser and rotate it in the same direction as the ship
        let newLaser = this.laserSymbol.place(this.ship!.position);
        newLaser.rotation = this.mouseVector.angle;
        
        // Push the normalized mouse vector to the direction array, and add the new laser to the lasers group
        this.laserDir!.push(this.mouseVector.normalize(7));
        newLaser.addTo(this.lasers!);
    } 

    // Generates a random point inside the canvas
    private pointRandom(maxX : number, maxY : number) : paper.Point
    {
        let randX = Math.random() * maxX;
        let randY = Math.random() * maxY;

        return new paper.Point(randX, randY);
    }

    // Generates a point off-screen in a direction related to where the mouse is pointing
    private pointOOB() : paper.Point
    {
        let xPos, yPos : number;
        let angle = this.mouseVector.angle;

        // 75% of the time, a point in front of the ship is generated
        if (Math.random() < 0.75) {
            if ((angle < 45 && angle >= 0) || (angle < 0 && angle >= -45)) {
                xPos = 50 * Math.random() + this.width;
                yPos = this.height * Math.random(); 
            }
            else if (angle <= -45 && angle > -135) {
                xPos = this.width * Math.random(); 
                yPos = -50 * Math.random();
            }
            else if ((angle <= 180 && angle >= 135) || (angle < -135 && angle >= -180)) {
                xPos = -50 * Math.random();
                yPos = this.height * Math.random(); 
            }
            else {
                xPos = this.width * Math.random(); 
                yPos = 50 * Math.random() + this.height;
            }
        } 

        // The other 25% of the time, a point is generated behind the ship
        else {
            if ((angle < 45 && angle >= 0) || (angle < 0 && angle >= -45)) {
                xPos = -50 * Math.random();
                yPos = this.height * Math.random(); 
            }
            else if (angle <= -45 && angle > -135) {
                xPos = this.width * Math.random(); 
                yPos = 50 * Math.random() + this.height;
            }
            else if ((angle <= 180 && angle >= 135) || (angle < -135 && angle >= -180)) {
                xPos = 50 * Math.random() + this.width;
                yPos = this.height * Math.random(); 
            }
            else {
                xPos = this.width * Math.random(); 
                yPos = -50 * Math.random();
            }
        }

        // Create and return the out of bounds point
        return new paper.Point(xPos, yPos);
    }

    // Generates an explosion on the specified mine and removes the mine
    private removeMine(mine : paper.Item) : void
    {
        let explosion = this.explosionSymbol.place(mine!.position)
        explosion.addTo(this.explosions!);
        mine.remove();
    }

}

// This is included because the paper is missing a TypeScript definition
// You do not need to modify it
class GameEvent
{
    readonly delta: number;
    readonly time: number;
    readonly count: number;

    constructor()
    {
        this.delta = 0;
        this.time = 0;
        this.count = 0;
    }
}
    
// Start the game
var game = new Game();
game.start();