export class RoomConnection {
  constructor(roomA, roomB) {
    this.roomA = roomA;
    this.roomB = roomB;
    this.corridoor = null;
  }

  get sourceRoom() {
    return this.roomA;
  }

  get destinationRoom() {
    return this.roomB;
  }

  otherRoom(room) {
    return this.roomA === room ? this.roomB : this.roomA;
  }

  involves(room) {
    return this.roomA === room || this.roomB === room;
  }

  setCorridoor(corridoor) {
    this.corridoor = corridoor;
  }

  getAllCells() {
    return this.corridoor?.path ?? [];
  }

  cellIsOnCorridoor(cell) {
    return this.corridoor?.cellIsOnCorridoor(cell) ?? false;
  }
}
