import { COMPENDIUM } from '@shared/compendium'
import { registerKindUi } from '../../registries/kinds'
import '../data/sheet/dnd/facet'
import { CompendiumImporter } from './CompendiumImporter'
import { CompendiumScreen, NEW_ENTRY } from './CompendiumScreen'
import { CompendiumChat, CompendiumWidget } from './CompendiumChat'
import { entryWidget } from '../../registries/widgets'

for (const info of COMPENDIUM)
  registerKindUi(info.kind, {
    present: { Screen: CompendiumScreen, Chat: CompendiumChat, Stage: CompendiumChat, Widget: entryWidget(CompendiumWidget) },
    addLabel: `New ${info.label.toLowerCase()}`,
    add: (kind, select) => () => select({ kind, id: NEW_ENTRY }),
    importer: ({ onClose }) => <CompendiumImporter kind={info.kind} onClose={onClose} />
  })
