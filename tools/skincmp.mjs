import { NodeIO } from '@gltf-transform/core'
const io = new NodeIO()
const files = process.argv.slice(2)
for (const file of files) {
  const doc = await io.read(file)
  const skins = doc.getRoot().listSkins()
  for (const skin of skins) {
    const joints = skin.listJoints().map((j) => j.getName())
    const ibm = skin.getInverseBindMatrices()
    const m = ibm ? Array.from(ibm.getArray()).slice(0, 16).map((n) => Number(n.toFixed(4))) : null
    const meshNodes = doc.getRoot().listNodes().filter((n) => n.getSkin() === skin)
    console.log(`${file.split('/').pop()}  joints=${joints.length}  first3=${joints.slice(0, 3)}  node=${meshNodes.map((n) => n.getName())}`)
    console.log(`   nodeMatrix=${meshNodes[0]?.getMatrix().map((n) => Number(n.toFixed(3)))}`)
    console.log(`   ibm[0..15]=${m}`)
  }
}
