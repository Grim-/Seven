import { Dungeon } from './Dungeon.js';
import { DungeonGenerationContext } from './DungeonGenerationContext.js';
import {
  BspStructureGenerationStep,
  ConnectionGenerationStep,
  CriticalPathDesignationStep,
  EarlyAutomataStep,
  GenerateCorridoorsStep,
  GridApplicationStep,
  HiddenRoomSealingStep,
  MapInitializationStep,
  MinimumSpanningTreeStep,
  PostAutomataStep,
  RoomCreationStep,
  RoomTypeAssignmentStep,
  RoomWorkerApplicationStep,
  SidePathProcessingStep,
  SideRoomTypeUpdateStep,
} from './DungeonSteps.js';

export class DungeonGenerator {
  constructor(reg, defId, bounds, seed) {
    this.dungeon = new Dungeon(reg, defId, bounds);
    this.context = new DungeonGenerationContext(this.dungeon, reg, seed);
    this.generationSteps = this.createGenerationSteps();
    this.currentStepIndex = 0;
    this.errors = [];
  }

  get generationComplete() {
    return this.currentStepIndex >= this.generationSteps.length;
  }

  get generatedDungeon() {
    return this.dungeon;
  }

  async generate(loading = null) {
    while (!this.generationComplete) {
      const step = this.generationSteps[this.currentStepIndex];
      loading?.progress?.(`Dungeon: ${step.label} (${this.currentStepIndex + 1}/${this.generationSteps.length})`);
      this.stepGeneration();
    }
    return this.dungeon;
  }

  stepGeneration() {
    if (this.generationComplete) return;

    const step = this.generationSteps[this.currentStepIndex];
    try {
      step.execute(this.context);
    } catch (err) {
      const message = `dungeon step ${this.currentStepIndex + 1} ${step.label}: ${err.message}`;
      this.errors.push(message);
    }

    this.currentStepIndex++;
  }

  createGenerationSteps() {
    return [
      new MapInitializationStep(),
      new BspStructureGenerationStep(),
      new RoomCreationStep(),
      new EarlyAutomataStep(),
      new MinimumSpanningTreeStep(),
      new ConnectionGenerationStep(),
      new CriticalPathDesignationStep(),
      new SidePathProcessingStep(),
      new RoomTypeAssignmentStep(),
      new SideRoomTypeUpdateStep(),
      new GenerateCorridoorsStep(),
      new GridApplicationStep(),
      new PostAutomataStep(),
      new RoomWorkerApplicationStep(),
      new HiddenRoomSealingStep(),
    ];
  }
}
