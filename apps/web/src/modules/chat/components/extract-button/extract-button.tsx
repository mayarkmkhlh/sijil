import { Button } from "../../../../components/button/button.js";
import { Icon } from "../../../../components/icon/icon.js";
import { Loader } from "../../../../components/loader/loader.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";

export function ExtractButton({
  busy,
  disabled,
  copy,
  onExtract,
}: {
  busy: boolean;
  disabled: boolean;
  copy: Copy;
  onExtract: () => void;
}) {
  return (
    <div className="extract-dock">
      <Button className="btn-block" disabled={disabled || busy} onClick={onExtract}>
        {busy ? <Loader label={copy.extracting} /> : <Icon name="spark" />}
        {busy ? copy.extracting : copy.extract}
      </Button>
      <p className="extract-note">{copy.extractNote}</p>
    </div>
  );
}
