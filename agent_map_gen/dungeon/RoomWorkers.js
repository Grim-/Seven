export class RoomTypeWorker {
  constructor(defId, def = {}, room = null) {
    this.defId = defId;
    this.def = def;
    this.currentRoom = room;
  }

  applyRoom(context, room) {
    if (this.def.canmodifyterrain) this.modifyRoomTerrain(context, room);
    if (this.def.canmodifyfloor) this.modifyRoomFloor(context, room);
    if (this.def.canmodifywalls) this.modifyRoomWalls(context, room);
  }

  canApply(context, room) {
    const max = this.def.maxroomtypecount ?? 0;
    return !(max > 0 && context.dungeon.getRoomTypeCount(this.defId, room) >= max);
  }

  modifyRoomTerrain(context, room) {}
  modifyRoomFloor(context, room) {}
  modifyRoomWalls(context, room) {}
}

export class EmptyRoom extends RoomTypeWorker {}
export class StartRoom extends RoomTypeWorker {}
export class EndRoom extends RoomTypeWorker {}

export function roomTypeWorker(reg, defId, room) {
  const def = reg.def('roomtypes', defId);
  const Cls = reg.dungeonClass('roomworker', def.workerclass);
  return new Cls(defId, def, room);
}

export const ROOM_WORKER_CLASSES = {
  EmptyRoom,
  StartRoom,
  EndRoom,
  empty: EmptyRoom,
  start: StartRoom,
  end: EndRoom,
};
