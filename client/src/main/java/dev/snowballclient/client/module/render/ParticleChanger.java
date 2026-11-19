package dev.snowballclient.client.module.render;

import dev.snowballclient.client.module.Module;
import dev.snowballclient.client.module.ModuleCategory;
import dev.snowballclient.client.module.setting.BooleanSetting;
import dev.snowballclient.client.module.setting.NumberSetting;
import net.minecraft.client.particle.Particle;

/** Client-only particle visibility controls, separate from the FPS particle limiter. */
public final class ParticleChanger extends Module {
	public final NumberSetting density = setting(new NumberSetting("density", "Particle density", "Percentage of particles to keep", 100, 0, 100, 5).unit("%"));
	public final BooleanSetting critical = setting(new BooleanSetting("critical", "Critical particles", "Show critical-hit particles", true));
	public final BooleanSetting damage = setting(new BooleanSetting("damage", "Damage particles", "Show damage and enchantment particles", true));
	public final BooleanSetting ambient = setting(new BooleanSetting("ambient", "Ambient particles", "Show ambient particles such as cave air", true));
	private int accumulator;

	public ParticleChanger() {
		super("particle_changer", "Particle Changer", "Control particle density and families", ModuleCategory.RENDER);
	}

	/** @return true when this particle should be removed before rendering */
	public boolean shouldDrop(Particle particle) {
		if (!isEnabled()) return false;
		String name = particle.getClass().getSimpleName().toLowerCase(java.util.Locale.ROOT);
		if (!critical.isOn() && name.contains("crit")) return true;
		if (!damage.isOn() && (name.contains("damage") || name.contains("enchant"))) return true;
		if (!ambient.isOn() && name.contains("ambient")) return true;
		int keep = density.intValue();
		if (keep >= 100) return false;
		if (keep <= 0) return true;
		accumulator += keep;
		if (accumulator >= 100) {
			accumulator -= 100;
			return false;
		}
		return true;
	}
}
