package dev.snowballclient.client.module.render;

import dev.snowballclient.client.hud.TextHudModule;
import dev.snowballclient.client.module.ModuleCategory;
import dev.snowballclient.client.module.setting.BooleanSetting;
import net.minecraft.client.Minecraft;
import net.minecraft.world.phys.BlockHitResult;

/** Shows the block currently under the crosshair, similar to WAILA/HWYLA. */
public final class Waila extends TextHudModule {
	private final BooleanSetting showCoordinates = setting(new BooleanSetting("coordinates", "Show coordinates", "Include the targeted block position", true));
	private final BooleanSetting showState = setting(new BooleanSetting("state", "Show block state", "Include the block's state properties", false));

	public Waila() {
		super("waila", "WAILA", "Shows information about the block you are looking at", ModuleCategory.WORLD, 0.0, 0.48);
	}

	@Override
	protected String computeText(Minecraft mc) {
		if (mc.level == null || !(mc.hitResult instanceof BlockHitResult hit) || !hit.getType().equals(net.minecraft.world.phys.HitResult.Type.BLOCK)) return null;
		var pos = hit.getBlockPos();
		var state = mc.level.getBlockState(pos);
		StringBuilder text = new StringBuilder(state.getBlock().getName().getString());
		if (showCoordinates.isOn()) text.append("  ").append(pos.getX()).append(' ').append(pos.getY()).append(' ').append(pos.getZ());
		if (showState.isOn()) text.append("  ").append(state.getValues());
		return text.toString();
	}
}
