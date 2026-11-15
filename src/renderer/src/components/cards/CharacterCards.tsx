import { OwnerDeck } from './OwnerDeck'

export function CharacterCards({ sheet }: { sheet: string }) {
  return (
    <div className="flex min-h-[32rem] flex-1 flex-col p-4">
      <OwnerDeck owner={{ character: sheet }} />
    </div>
  )
}
