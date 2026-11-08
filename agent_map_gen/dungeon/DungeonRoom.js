import { CARDINALS, CellRect, cellKey, distanceSquared, flattenCells, unflattenCells } from '../CellRect.js';
import { minBy, randomElement } from '../DungeonRand.js';

const MAX_DIFFICULTY_TIER = 5;
const CONNECTION_POINT_RANGE = 3;

export class DungeonRoom {
  constructor(dungeon, id) {
    this.parentDungeon = dungeon;
    this.id = id;
    this.roomCellRectCache = null;
    this.roomWalls = new CellRect(0, 0, 0, 0);
    this.tags = [];
    this.connectedRooms = [];
    this.connections = [];
    this.def = null;
    this.defId = null;
    this.distanceFromStart = 0;
    this.roomShape = null;
    this.layoutId = null;
    this.roomCells = [];
    this.roomCellKeys = new Set();
    this.criticalPathIndex = -1;
    this.isWaypoint = false;
  }

  get roomCellRect() {
    if (!this.roomCellRectCache) this.roomCellRectCache = CellRect.fromCellList(this.roomCells);
    return this.roomCellRectCache;
  }

  set roomCellRect(rect) {
    this.roomCellRectCache = rect;
  }

  get isOnCriticalPath() {
    return this.criticalPathIndex >= 0;
  }

  get center() {
    return this.roomCellRect.centerCell;
  }

  get roomType() {
    return this.def?.roomtype ?? null;
  }

  get progressionValue() {
    if (!this.parentDungeon) return 1;

    const criticalPathRooms = this.parentDungeon.getAllCriticalPathRooms();
    if (criticalPathRooms.length <= 1) return 1;
    if (this.isOnCriticalPath) return this.criticalPathIndex / (criticalPathRooms.length - 1);
    return 1;
  }

  get difficultyTier() {
    return MAX_DIFFICULTY_TIER;
  }

  setDef(reg, defId) {
    this.defId = defId ?? null;
    this.def = defId ? reg.def('roomtypes', defId) : null;
  }

  getCorners() {
    const rect = this.roomCellRect;
    return [
      { x: rect.minX, y: rect.minY },
      { x: rect.minX, y: rect.maxY },
      { x: rect.maxX, y: rect.minY },
      { x: rect.maxX, y: rect.maxY },
    ];
  }

  containsCell(cell) {
    return this.roomCellKeys.has(cellKey(cell.x, cell.y));
  }

  setRoomCells(cells) {
    this.roomCells = cells;
    this.roomCellKeys = new Set(cells.map((cell) => cellKey(cell.x, cell.y)));
    this.roomCellRectCache = null;
  }

  generateRoomGeometry(context, bounds, roomLayoutData, minPadding = 1, roomSizeFactor = 1) {
    const reg = context.reg;
    const layouts = roomLayoutData?.layouts ?? [];
    const layoutId = layouts.length ? randomElement(context.rng, layouts) : randomElement(context.rng, reg.ids('roomlayouts'));
    const layout = reg.def('roomlayouts', layoutId);

    this.layoutId = layoutId;
    const ShapeClass = reg.dungeonClass('roomshape', layout.workerclass);
    this.roomShape = new ShapeClass(layout);

    const maxDim = context.def.maxroomsize ?? 24;
    let roomWidth = Math.min(maxDim, Math.trunc(bounds.width * roomSizeFactor));
    let roomHeight = Math.min(maxDim, Math.trunc(bounds.height * roomSizeFactor));

    const minSize = roomLayoutData?.minsizerequired ?? null;
    if (minSize) {
      roomWidth = Math.max(minSize[0], roomWidth);
      roomHeight = Math.max(minSize[1], roomHeight);
    }

    roomWidth = Math.max(4, Math.min(roomWidth, bounds.width - minPadding * 2));
    roomHeight = Math.max(4, Math.min(roomHeight, bounds.height - minPadding * 2));

    const roomX = bounds.minX + minPadding + Math.max(0, Math.trunc((bounds.width - minPadding * 2 - roomWidth) / 2));
    const roomY = bounds.minY + minPadding + Math.max(0, Math.trunc((bounds.height - minPadding * 2 - roomHeight) / 2));
    const roomBounds = new CellRect(roomX, roomY, roomWidth, roomHeight);

    let cells = this.roomShape.generateRoomCells(context, roomBounds, layout.layoutsizemultiplier ?? 1);
    if (!cells || !cells.length) cells = roomBounds.cells();

    this.setRoomCells(cells);
  }

  static fromBspNode(dungeon, node, context, roomLayoutData, minPadding = 2, roomSizeFactor = 1) {
    const room = dungeon.createRoom();
    room.generateRoomGeometry(context, node.rect, roomLayoutData, minPadding, roomSizeFactor);

    const rect = room.roomCellRect;
    room.roomWalls = new CellRect(rect.minX - 1, rect.minY - 1, rect.width + 2, rect.height + 2);
    room.setDef(context.reg, roomLayoutData.roomtype);

    for (const tag of node.tags) room.addTag(tag);
    return room;
  }

  setCriticalPathIndex(index) {
    this.criticalPathIndex = index;
  }

  hasConnectionTo(otherRoom) {
    return this.connections.some((c) => c.otherRoom(this) === otherRoom);
  }

  isConnectedTo(otherRoom) {
    return this.connectedRooms.includes(otherRoom);
  }

  hasAnyForwardConnections() {
    return this.connections.some((c) => c.sourceRoom === this);
  }

  entranceCells() {
    const out = [];
    for (const connection of this.connections) {
      if (!connection.corridoor) continue;
      out.push(connection.corridoor.start, connection.corridoor.end);
    }
    return out;
  }

  getOptimalConnectionPoint(targetRoom) {
    const direction = { x: targetRoom.center.x - this.center.x, y: targetRoom.center.y - this.center.y };
    const sourceRect = this.roomCellRect;
    const candidatePoints = [];

    if (Math.abs(direction.x) > Math.abs(direction.y)) {
      const faceX = direction.x > 0 ? sourceRect.maxX : sourceRect.minX;
      const centerY = sourceRect.centerCell.y;
      const range = Math.min(CONNECTION_POINT_RANGE, Math.trunc(sourceRect.height / 3));
      for (let y = centerY - range; y <= centerY + range; y++) {
        const candidate = { x: faceX, y };
        if (this.containsCell(candidate)) candidatePoints.push(candidate);
      }
    } else {
      const faceY = direction.y > 0 ? sourceRect.maxY : sourceRect.minY;
      const centerX = sourceRect.centerCell.x;
      const range = Math.min(CONNECTION_POINT_RANGE, Math.trunc(sourceRect.width / 3));
      for (let x = centerX - range; x <= centerX + range; x++) {
        const candidate = { x, y: faceY };
        if (this.containsCell(candidate)) candidatePoints.push(candidate);
      }
    }

    if (!candidatePoints.length) return this.center;
    return minBy(candidatePoints, (point) => distanceSquared(point, targetRoom.center));
  }

  getBestEdgePoint(room, direction) {
    const edgePoints = room.getRoomEdgePoints();
    const horizontal = Math.abs(direction.x) > Math.abs(direction.y);

    let validEdgePoints = edgePoints.filter((point) => (horizontal
      ? Math.sign(point.x - room.center.x) === Math.sign(direction.x)
      : Math.sign(point.y - room.center.y) === Math.sign(direction.y)));
    if (!validEdgePoints.length) validEdgePoints = edgePoints;

    const targetEdgeCenter = { ...room.center };
    if (horizontal) targetEdgeCenter.x += Math.sign(direction.x) * Math.trunc(room.roomCellRect.width / 2);
    else targetEdgeCenter.y += Math.sign(direction.y) * Math.trunc(room.roomCellRect.height / 2);

    return minBy(validEdgePoints, (point) => distanceSquared(point, targetEdgeCenter));
  }

  getRoomEdgePoints() {
    return this.roomCells.filter((cell) => CARDINALS.some((dir) => !this.containsCell({ x: cell.x + dir.x, y: cell.y + dir.y })));
  }

  canBuildHere(cellOrRect) {
    const entrances = this.entranceCells();
    if (cellOrRect instanceof CellRect) return !entrances.some((cell) => cellOrRect.contains(cell));
    return !entrances.some((cell) => cell.x === cellOrRect.x && cell.y === cellOrRect.y);
  }

  addTag(tag) {
    if (!this.tags.includes(tag)) this.tags.push(tag);
  }

  removeTag(tag) {
    this.tags = this.tags.filter((t) => t !== tag);
  }

  hasTag(tag) {
    return this.tags.includes(tag);
  }

  toJSON() {
    return {
      id: this.id,
      def: this.defId,
      layout: this.layoutId,
      tags: [...this.tags],
      cells: flattenCells(this.roomCells),
      walls: this.roomWalls.toJSON(),
      criticalpathindex: this.criticalPathIndex,
      iswaypoint: this.isWaypoint,
      distancefromstart: this.distanceFromStart,
    };
  }

  static fromJSON(dungeon, reg, data) {
    const room = new DungeonRoom(dungeon, data.id);
    room.setDef(reg, data.def);
    room.layoutId = data.layout ?? null;
    if (room.layoutId && reg.has('roomlayouts', room.layoutId)) {
      const layout = reg.def('roomlayouts', room.layoutId);
      const ShapeClass = reg.dungeonClass('roomshape', layout.workerclass);
      room.roomShape = new ShapeClass(layout);
    }
    room.tags = [...(data.tags ?? [])];
    room.setRoomCells(unflattenCells(data.cells));
    room.roomWalls = CellRect.fromJSON(data.walls);
    room.criticalPathIndex = data.criticalpathindex ?? -1;
    room.isWaypoint = !!data.iswaypoint;
    room.distanceFromStart = data.distancefromstart ?? 0;
    return room;
  }
}
