import { Desc, Eyebrow, Title } from "@/components/primitives";

/** No numeric zeros, no empty chips — a zero implies mail that isn't there. */
export const NotConnected = ({
  orgNames,
  onConnect,
}: {
  orgNames: string[];
  onConnect: () => void;
}) => (
  <div className="mb-empty">
    <Eyebrow>Mail</Eyebrow>
    <Title>
      {orgNames.length === 1
        ? `${orgNames[0]} has no mail account yet`
        : "No mail accounts connected yet"}
    </Title>
    <Desc>
      I can't read mail for {orgNames.join(", ") || "your organisations"} yet.
      Connect a dedicated account and I'll help you sort what matters and draft replies.
      Each organisation connects its own account — everything in it becomes visible
      to that organisation's members, so connect a dedicated address, not a personal one.
    </Desc>
    {orgNames.length > 1 ? (
      <div className="mb-emptylist">
        {orgNames.map((n) => (
          <span key={n} className="mb-emptyorg">{n}</span>
        ))}
      </div>
    ) : null}
    <button type="button" className="b-pri" data-size="md" onClick={onConnect}>
      Connect an account
    </button>
  </div>
);

/** The best moment the product has. Treated as such. */
export const InboxZero = () => (
  <div className="mb-empty">
    <Eyebrow>Nothing left</Eyebrow>
    <Title>You are through it.</Title>
    <Desc>
      Every message across your organisations is handled. Nothing is waiting on you,
      and nothing is quietly sitting in a category you haven't looked at.
    </Desc>
  </div>
);

export const FilterEmpty = ({ copy }: { copy: string }) => (
  <div className="mb-empty mb-empty-sm">
    <Desc>{copy}</Desc>
  </div>
);

export const NoSelection = () => (
  <div className="mb-empty mb-empty-sm">
    <Desc>Pick a message.</Desc>
  </div>
);
