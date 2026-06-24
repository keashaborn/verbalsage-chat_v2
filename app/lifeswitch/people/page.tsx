import Link from "next/link";
import { MessageSquare, Users, UserRoundCheck, Handshake } from "lucide-react";

function Card({
  href,
  title,
  body,
  icon: Icon,
}: {
  href: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="rounded-xl border p-4 hover:bg-muted/30 active:bg-muted/40">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border p-2">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</div>
        </div>
      </div>
    </Link>
  );
}

export default function LifeSwitchPeoplePage() {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">People</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Private LifeSwitch connections for messages, workout friends, and permissioned plan help.
        </div>
      </div>

      <div className="grid gap-3">
        <Card
          href="/lifeswitch/people/messages"
          title="Messages"
          body="Text with workout friends and training partners. First version is private one-to-one messaging."
          icon={MessageSquare}
        />

        <Card
          href="/lifeswitch/people/friends"
          title="Friends"
          body="Manage accepted LifeSwitch connections. Invite links and contact lookup come later."
          icon={Users}
        />

        <Card
          href="/lifeswitch/people/helping"
          title="People I Help"
          body="For plan-helper access: build workouts, review logs, and guide someone else’s plan once permissions are added."
          icon={UserRoundCheck}
        />

        <Card
          href="/lifeswitch/people/helping-me"
          title="People Helping Me"
          body="Control who can view, comment on, or later edit parts of your LifeSwitch plan."
          icon={Handshake}
        />
      </div>
    </div>
  );
}
