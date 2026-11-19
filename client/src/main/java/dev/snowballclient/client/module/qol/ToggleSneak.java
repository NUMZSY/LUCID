package dev.snowballclient.client.module.qol;

import dev.snowballclient.client.hud.TextHudModule;
import dev.snowballclient.client.module.ModuleCategory;
import dev.snowballclient.client.module.setting.BooleanSetting;
import net.minecraft.client.Minecraft;

/** Keeps the sneak key held while enabled, without changing vanilla movement rules. */
public final class ToggleSneak extends TextHudModule {
	private static final int KEY_H = 72;
	public final BooleanSetting showLabel = setting(new BooleanSetting("show_label", "Show status label", "", true));

	public ToggleSneak() {
		super("toggle_sneak", "Toggle Sneak", "Sneak without holding", ModuleCategory.MOVEMENT, 0.0, 0.91);
		setKeybind(KEY_H);
	}

	@Override
	public void onTick() {
		Minecraft mc = Minecraft.getInstance();
		if (mc.player != null && mc.gui.screen() == null) mc.options.keyShift.setDown(true);
		super.onTick();
	}

	@Override
	protected void onDisable() {
		Minecraft mc = Minecraft.getInstance();
		mc.options.keyShift.setDown(false);
		super.onDisable();
	}

	@Override
	protected String computeText(Minecraft mc) {
		return showLabel.isOn() ? "Sneak: toggled" : null;
	}
}
