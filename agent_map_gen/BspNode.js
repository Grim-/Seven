import { CellRect } from './CellRect.js';

export class BspNode {
  constructor(rect) {
    this.id = null;
    this.rect = rect;
    this.left = null;
    this.right = null;
    this.tags = [];
    this.connectedNodes = [];
  }

  isLeaf() {
    return this.left === null && this.right === null;
  }

  addTag(tag) {
    if (!this.tags.includes(tag)) this.tags.push(tag);
  }

  hasTag(tag) {
    return this.tags.includes(tag);
  }

  toJSON() {
    return {
      id: this.id,
      rect: this.rect.toJSON(),
      left: this.left?.toJSON() ?? null,
      right: this.right?.toJSON() ?? null,
      tags: [...this.tags],
      connected: this.connectedNodes.map((node) => node.id),
    };
  }

  static treeFromJSON(data) {
    const byId = new Map();
    const links = [];
    const root = BspNode.readNode(data, byId, links);

    for (const [node, ids] of links) {
      node.connectedNodes = ids.map((id) => byId.get(id)).filter(Boolean);
    }

    return { root, byId };
  }

  static readNode(data, byId, links) {
    const node = new BspNode(CellRect.fromJSON(data.rect));
    node.id = data.id;
    node.tags = [...(data.tags || [])];
    byId.set(node.id, node);

    if (data.connected?.length) links.push([node, data.connected]);
    if (data.left) node.left = BspNode.readNode(data.left, byId, links);
    if (data.right) node.right = BspNode.readNode(data.right, byId, links);

    return node;
  }
}
