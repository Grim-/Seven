import { RoomConnection } from './RoomConnection.js';

export class DungeonConnectionManager {
  constructor(dungeon) {
    this.dungeon = dungeon;
    this.connections = new Map();
  }

  get allConnections() {
    return [...this.connections.values()];
  }

  connectRooms(roomA, roomB) {
    if (!roomA || !roomB || roomA === roomB) return null;

    const connectionId = this.getConnectionId(roomA, roomB);
    if (this.connections.has(connectionId)) return this.connections.get(connectionId);

    const connection = new RoomConnection(roomA, roomB);
    this.connections.set(connectionId, connection);

    roomA.connections.push(connection);
    roomB.connections.push(connection);
    if (!roomA.connectedRooms.includes(roomB)) roomA.connectedRooms.push(roomB);
    if (!roomB.connectedRooms.includes(roomA)) roomB.connectedRooms.push(roomA);

    return connection;
  }

  disconnectRooms(roomA, roomB) {
    const connectionId = this.getConnectionId(roomA, roomB);
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.connections.delete(connectionId);
    roomA.connections = roomA.connections.filter((c) => c !== connection);
    roomB.connections = roomB.connections.filter((c) => c !== connection);
    roomA.connectedRooms = roomA.connectedRooms.filter((r) => r !== roomB);
    roomB.connectedRooms = roomB.connectedRooms.filter((r) => r !== roomA);
  }

  getConnection(roomA, roomB) {
    return this.connections.get(this.getConnectionId(roomA, roomB)) ?? null;
  }

  hasAnyConnections(room) {
    return room.connections.length > 0;
  }

  getConnectionCount(room) {
    return room.connectedRooms.length;
  }

  areRoomsConnected(roomA, roomB) {
    return this.connections.has(this.getConnectionId(roomA, roomB));
  }

  getConnectionsForRoom(room) {
    return this.allConnections.filter((c) => c.involves(room));
  }

  getConnectedRooms(room) {
    return this.allConnections.filter((c) => c.destinationRoom === room).map((c) => c.sourceRoom);
  }

  applyConnectionsToGrid() {
    for (const connection of this.connections.values()) {
      if (!connection.corridoor) continue;
      for (const cell of connection.corridoor.getAllCorridorCells()) this.dungeon.markCellAsFloor(cell);
    }
  }

  generateConnectionsFromRoomGraph() {
    for (const room of this.dungeon.getAllRooms()) {
      for (const connectedRoom of [...room.connectedRooms]) this.connectRooms(room, connectedRoom);
    }
  }

  reset() {
    for (const room of this.dungeon.getAllRooms()) {
      room.connections = [];
      room.connectedRooms = [];
    }
    this.connections.clear();
  }

  getConnectionId(roomA, roomB) {
    return roomA.id < roomB.id ? `${roomA.id}-${roomB.id}` : `${roomB.id}-${roomA.id}`;
  }

  toJSON() {
    return this.allConnections.map((c) => ({
      a: c.roomA.id,
      b: c.roomB.id,
      corridoor: c.corridoor?.toJSON() ?? null,
    }));
  }
}
