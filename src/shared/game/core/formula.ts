type Node =
  | { op: 'num'; value: number }
  | { op: 'var'; name: string }
  | { op: 'dice'; count: number; sides: number }
  | { op: 'neg'; arg: Node }
  | { op: 'bin'; sign: string; left: Node; right: Node }
  | { op: 'call'; name: string; args: Node[] }

export interface FormulaScope {
  value: (name: string) => number | undefined
  dice?: (count: number, sides: number) => number
}

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  abs: Math.abs,
  clamp: (x, a, b) => Math.min(b, Math.max(a, x))
}

const TOKEN = /\s*(?:(\d+)d(\d+)|(\d+(?:\.\d+)?)|([A-Za-z_][\w.]*)|(.))/y

function tokens(source: string): string[][] {
  const out: string[][] = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < source.length) {
    const m = TOKEN.exec(source)
    if (!m) break
    if (m[0].trim() === '') continue
    if (m[1]) out.push(['dice', m[1], m[2]])
    else if (m[3]) out.push(['num', m[3]])
    else if (m[4]) out.push(['name', m[4]])
    else out.push(['sym', m[5]])
  }
  return out
}

function parse(source: string): Node {
  const list = tokens(source)
  let i = 0
  const peek = (sym: string) => list[i]?.[0] === 'sym' && list[i][1] === sym
  const expect = (sym: string) => {
    if (!peek(sym)) throw new Error(`Formula "${source}": expected "${sym}"`)
    i++
  }
  const primary = (): Node => {
    const t = list[i++]
    if (!t) throw new Error(`Formula "${source}" ends too soon`)
    if (t[0] === 'num') return { op: 'num', value: Number(t[1]) }
    if (t[0] === 'dice') return { op: 'dice', count: Number(t[1]), sides: Number(t[2]) }
    if (t[0] === 'name') {
      if (!peek('(')) return { op: 'var', name: t[1] }
      i++
      const args: Node[] = []
      if (!peek(')')) {
        args.push(expr())
        while (peek(',')) {
          i++
          args.push(expr())
        }
      }
      expect(')')
      if (!FUNCTIONS[t[1]]) throw new Error(`Formula "${source}": unknown function ${t[1]}`)
      return { op: 'call', name: t[1], args }
    }
    if (t[1] === '(') {
      const inner = expr()
      expect(')')
      return inner
    }
    throw new Error(`Formula "${source}": unexpected "${t[1]}"`)
  }
  const unary = (): Node => {
    if (peek('-')) {
      i++
      return { op: 'neg', arg: unary() }
    }
    if (peek('+')) {
      i++
      return unary()
    }
    const base = primary()
    if (peek('^')) {
      i++
      return { op: 'bin', sign: '^', left: base, right: unary() }
    }
    return base
  }
  const term = (): Node => {
    let left = unary()
    while (peek('*') || peek('/') || peek('%')) left = { op: 'bin', sign: list[i++][1], left, right: unary() }
    return left
  }
  const expr = (): Node => {
    let left = term()
    while (peek('+') || peek('-')) left = { op: 'bin', sign: list[i++][1], left, right: term() }
    return left
  }
  const tree = expr()
  if (i < list.length) throw new Error(`Formula "${source}": unexpected "${list[i][1]}"`)
  return tree
}

const compiled = new Map<string, Node>()

function run(node: Node, scope: FormulaScope): number {
  switch (node.op) {
    case 'num':
      return node.value
    case 'var': {
      const v = scope.value(node.name)
      if (v === undefined) throw new Error(`Formula: unknown value ${node.name}`)
      return v
    }
    case 'dice':
      if (!scope.dice) throw new Error('Formula: dice are not available here')
      return scope.dice(node.count, node.sides)
    case 'neg':
      return -run(node.arg, scope)
    case 'call':
      return FUNCTIONS[node.name](...node.args.map((a) => run(a, scope)))
    case 'bin': {
      const a = run(node.left, scope)
      const b = run(node.right, scope)
      if (node.sign === '+') return a + b
      if (node.sign === '-') return a - b
      if (node.sign === '*') return a * b
      if (node.sign === '/') return b === 0 ? 0 : a / b
      if (node.sign === '%') return b === 0 ? 0 : a % b
      return a ** b
    }
  }
}

export function checkFormula(source: string): string | null {
  try {
    parse(source)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

export function evaluate(source: string, scope: FormulaScope): number {
  let tree = compiled.get(source)
  if (!tree) {
    tree = parse(source)
    compiled.set(source, tree)
  }
  return run(tree, scope)
}
