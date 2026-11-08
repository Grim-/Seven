import { BspNode } from '../BspNode.js';
import { BspUtility } from '../BspUtility.js';
import { DungeonGridManager } from './DungeonGridManager.js';
import { DungeonRoomPathFinder } from './DungeonRoomPathFinder.js';
import { DungeonQueryManager } from './DungeonQueryManager.js';
import { DungeonConnectionManager } from './DungeonConnectionManager.js';
import { DungeonRoom } from './DungeonRoom.js';
import { Corridoor } from './Corridoor.js';
import { randomElement } from '../DungeonRand.js';

export class Dungeon {
  constructor(reg, defId, bounds) {
    this.reg = reg;
    this.defId = defId;
    this.def = reg.def('dungeons', defId);
    this.bounds = bounds;
    this.rootNode = null;
    this.leafNodes = [];
    this.startNode = null;
    this.endNode = null;
    this.nodeToRoomMap = new Map();
    this.sidePathNodes = [];
    this.hiddenRooms = new Set();
    this.nextRoomId = 0;
    this.gridManager = new DungeonGridManager(bounds);
    this.pathfinder = new DungeonRoomPathFinder();
    this.queryManager = new DungeonQueryManager();
    this.connectionManager = new DungeonConnectionManager(this);
  }

  get rooms() {
    return [...this.nodeToRoomMap.values()];
  }

  get bspNodes() {
    return [...this.nodeToRoomMap.keys()];
  }

  get normalRooms() {
    return this.rooms.filter((room) => room.roomType === 'normal');
  }

  get startRoom() {
    return this.startNode ? this.getRoom(this.startNode) : null;
  }

  get endRoom() {
    return this.endNode ? this.getRoom(this.endNode) : null;
  }

  setBspStructure(rootNode, leafNodes) {
    this.rootNode = rootNode;
    this.leafNodes = leafNodes;

    let id = 0;
    BspUtility.eachNode(rootNode, (node) => {
      node.id = id++;
    });
  }

  setCriticalPathEndpoints(start, end) {
    this.startNode = start;
    this.endNode = end;
  }

  createRoom() {
    return new DungeonRoom(this, this.nextRoomId++);
  }

  addRoom(node, room) {
    this.nodeToRoomMap.set(node, room);
  }

  getRoom(node) {
    return this.nodeToRoomMap.get(node) ?? null;
  }

  getNode(room) {
    for (const [node, mapped] of this.nodeToRoomMap) if (mapped === room) return node;
    return null;
  }

  hasMapping(node) {
    return this.nodeToRoomMap.has(node);
  }

  getAllRooms() {
    return this.rooms;
  }

  getAllCriticalPathRooms() {
    return this.rooms.filter((room) => room.isOnCriticalPath);
  }

  getAllMappings() {
    return [...this.nodeToRoomMap.entries()];
  }

  addSidePathNode(node) {
    if (!this.sidePathNodes.includes(node)) this.sidePathNodes.push(node);
  }

  getAllSidePathRooms() {
    return this.rooms.filter((room) => !room.isOnCriticalPath && room.hasTag('side_path'));
  }

  markRoomAsHidden(room) {
    if (this.hiddenRooms.has(room)) return;
    this.hiddenRooms.add(room);
    room.addTag('hidden');
  }

  getRandomHiddenRoom(rng) {
    return randomElement(rng, [...this.hiddenRooms]);
  }

  connectRooms(roomA, roomB) {
    return this.connectionManager.connectRooms(roomA, roomB);
  }

  disconnectRooms(roomA, roomB) {
    this.connectionManager.disconnectRooms(roomA, roomB);
  }

  markCellAsFloor(cell) {
    this.gridManager.markCellAsFloor(cell);
  }

  markCellAsWall(cell) {
    this.gridManager.markCellAsWall(cell);
  }

  isCellFloor(cell) {
    return this.gridManager.isCellFloor(cell);
  }

  markCellProtected(cell, isProtected) {
    this.gridManager.markCellProtected(cell, isProtected);
  }

  markCellsProtected(cells, isProtected) {
    this.gridManager.markCellsProtected(cells, isProtected);
  }

  isRoomCell(cell) {
    return this.rooms.some((room) => room.containsCell(cell));
  }

  isPathCell(cell) {
    return this.connectionManager.allConnections.some((connection) => connection.cellIsOnCorridoor(cell));
  }

  getRoomTypeCount(roomTypeId, except = null) {
    return this.rooms.filter((room) => room !== except && room.defId === roomTypeId).length;
  }

  getFurthestRoom(start) {
    return this.pathfinder.getFurthestRoom(start);
  }

  findPathBetween(start, end) {
    return this.pathfinder.findPathBetween(start, end);
  }

  findRoomBefore(rng, targetRoom) {
    if (targetRoom.isOnCriticalPath && targetRoom.criticalPathIndex > 0) {
      for (const connectedRoom of targetRoom.connectedRooms) {
        if (connectedRoom.isOnCriticalPath && connectedRoom.criticalPathIndex < targetRoom.criticalPathIndex) return connectedRoom;
      }

      const earlierRooms = this.rooms
        .filter((room) => room.isOnCriticalPath && room.criticalPathIndex < targetRoom.criticalPathIndex)
        .sort((a, b) => b.criticalPathIndex - a.criticalPathIndex);
      if (earlierRooms.length) return earlierRooms[0];
    }

    return this.pathfinder.findAccessibleRoomsBefore(rng, targetRoom, this.startRoom);
  }

  floorMask() {
    return this.gridManager.dungeonGrid.values.slice();
  }

  toJSON() {
    return {
      def: this.defId,
      root: this.rootNode?.toJSON() ?? null,
      leaves: this.leafNodes.map((node) => node.id),
      start: this.startNode?.id ?? null,
      end: this.endNode?.id ?? null,
      sidepaths: this.sidePathNodes.map((node) => node.id),
      rooms: this.getAllMappings().map(([node, room]) => ({ node: node.id, ...room.toJSON() })),
      hidden: [...this.hiddenRooms].map((room) => room.id),
      connections: this.connectionManager.toJSON(),
      nextroomid: this.nextRoomId,
      grid: this.gridManager.toJSON(),
    };
  }

  static fromJSON(reg, bounds, data) {
    const dungeon = new Dungeon(reg, data.def, bounds);
    const { root, byId } = data.root ? BspNode.treeFromJSON(data.root) : { root: null, byId: new Map() };

    dungeon.rootNode = root;
    dungeon.leafNodes = (data.leaves ?? []).map((id) => byId.get(id)).filter(Boolean);
    dungeon.startNode = byId.get(data.start) ?? null;
    dungeon.endNode = byId.get(data.end) ?? null;
    dungeon.sidePathNodes = (data.sidepaths ?? []).map((id) => byId.get(id)).filter(Boolean);
    dungeon.nextRoomId = data.nextroomid ?? 0;

    const roomsById = new Map();
    for (const saved of data.rooms ?? []) {
      const node = byId.get(saved.node);
      if (!node) continue;
      const room = DungeonRoom.fromJSON(dungeon, reg, saved);
      roomsById.set(room.id, room);
      dungeon.addRoom(node, room);
    }

    for (const id of data.hidden ?? []) {
      const room = roomsById.get(id);
      if (room) dungeon.hiddenRooms.add(room);
    }

    for (const saved of data.connections ?? []) {
      const connection = dungeon.connectRooms(roomsById.get(saved.a), roomsById.get(saved.b));
      if (connection && saved.corridoor) connection.setCorridoor(Corridoor.fromJSON(saved.corridoor));
    }

    dungeon.gridManager = DungeonGridManager.fromJSON(bounds, data.grid);
    return dungeon;
  }
}
