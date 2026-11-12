import crypto from 'node:crypto'
import os from 'node:os'
import forge from 'node-forge'

export interface Certificate {
  cert: string
  key: string
  fingerprint: string
}

export function localAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address)
}

export function makeCertificate(): Certificate {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
  const cert = forge.pki.createCertificate()
  cert.publicKey = forge.pki.publicKeyFromPem(pair.publicKey)
  cert.serialNumber = `01${crypto.randomBytes(15).toString('hex')}`
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 10)
  const subject = [{ name: 'commonName', value: `Seven on ${os.hostname()}` }]
  cert.setSubject(subject)
  cert.setIssuer(subject)
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: os.hostname() }, { type: 2, value: 'localhost' }, ...localAddresses().map((ip) => ({ type: 7, ip }))] }
  ])
  cert.sign(forge.pki.privateKeyFromPem(pair.privateKey), forge.md.sha256.create())
  const pem = forge.pki.certificateToPem(cert)
  return { cert: pem, key: pair.privateKey, fingerprint: new crypto.X509Certificate(pem).fingerprint256 }
}
