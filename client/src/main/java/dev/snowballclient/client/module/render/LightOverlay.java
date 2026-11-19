package dev.snowballclient.client.module.render;

import dev.snowballclient.client.hud.TextHudModule;
import dev.snowballclient.client.module.ModuleCategory;
import dev.snowballclient.client.module.setting.BooleanSetting;
import net.minecraft.client.Minecraft;
import net.minecraft.world.level.LightLayer;
import net.minecraft.world.phys.BlockHitResult;

/** Displays the light levels at the block under the crosshair. */
public final class LightOverlay extends TextHudModule {
	private final BooleanSetting showSky = setting(new BooleanSetting("sky_light", "Show sky light", "Include the sky light level", true));
	private final BooleanSetting showSpawnHint = setting(new BooleanSetting("spawn_hint", "Show spawn hint", "Warn when block light is low enough for hostile mobs", true));

	public LightOverlay() {
		super("light_overlay", "Light Overlay", "Shows block and sky light at the targeted block", ModuleCategory.WORLD, 0.0, 0.55);
	}

	@Override
	protected String computeText(Minecraft mc) {
		if (mc.level == null || !(mc.hitResult instanceof BlockHitResult hit)) return null;
		var pos = hit.getBlockPos();
		int block = mc.level.getBrightness(LightLayer.BLOCK, pos);
		int sky = mc.level.getBrightness(LightLayer.SKY, pos);
		String text = showSky.isOn() ? "Light " + block + " / Sky " + sky : "Light " + block;
		if (showSpawnHint.isOn() && block < 9) text += "  Spawn risk";
		return text;
	}
}
