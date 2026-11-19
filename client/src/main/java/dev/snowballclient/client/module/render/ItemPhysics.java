package dev.snowballclient.client.module.render;

import dev.snowballclient.client.module.Module;
import dev.snowballclient.client.module.ModuleCategory;
import dev.snowballclient.client.module.setting.BooleanSetting;

/** Changes only the local presentation of dropped item entities. */
public final class ItemPhysics extends Module {
	public final BooleanSetting flat = setting(new BooleanSetting("flat", "Lay items flat", "Dropped items rest on their side", true));
	public final BooleanSetting spin = setting(new BooleanSetting("spin", "Keep spinning", "Keep vanilla rotation instead of physics-style resting", false));

	public ItemPhysics() {
		super("item_physics", "Item Physics", "Make dropped items rest naturally instead of spinning upright", ModuleCategory.RENDER);
	}

	public float rotation(float vanilla) {
		return isEnabled() && flat.isOn() && !spin.isOn() ? 0f : vanilla;
	}

	public float bob(float vanilla) {
		return isEnabled() && flat.isOn() && !spin.isOn() ? 0f : vanilla;
	}
}
