import { FormulaEdit } from '../effects/tokens/FormulaToken'
import { registerParamEditor } from './registry'

registerParamEditor('formula', { Editor: FormulaEdit, wide: true })
