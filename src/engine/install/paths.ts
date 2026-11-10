function fromEnv(name: string, what: string): string {
  const dir = process.env[name]
  if (!dir) throw new Error(`Seven was started without its ${what} (${name}). Restart Seven.`)
  return dir
}

export function machineRoot(): string {
  return fromEnv('SEVEN_MACHINE', 'machine folder')
}

export function appFolder(): string {
  return fromEnv('SEVEN_APP', 'app folder')
}
