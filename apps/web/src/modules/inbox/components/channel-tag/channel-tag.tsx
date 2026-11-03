import type { Channel } from "../../../../lib/enums/channel.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";

export function ChannelTag({ channel, copy }: { channel: Channel; copy: Copy }) {
  return <span className="channel-tag">{copy.channels[channel]}</span>;
}
