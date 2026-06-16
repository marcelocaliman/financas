import { useUI } from "@/store/ui";
import { Drawer } from "@/components/common/drawer";
import Config from "@/pages/config";

/** Configurações num drawer de baixo pra cima (fora da navegação principal). */
export function ConfigDrawer() {
  const open = useUI((s) => s.configOpen);
  const setOpen = useUI((s) => s.setConfigOpen);
  return (
    <Drawer open={open} onClose={() => setOpen(false)} title="Configurações">
      <Config />
    </Drawer>
  );
}
