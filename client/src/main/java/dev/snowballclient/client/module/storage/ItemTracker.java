package dev.snowballclient.client.module.storage;

import dev.snowballclient.client.hud.TextHudModule;
import dev.snowballclient.client.module.ModuleCategory;
import net.minecraft.client.Minecraft;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.ItemStack;

/** Tracks the inventory delta for the item currently held since it was selected. */
public final class ItemTracker extends TextHudModule {
	private ItemStack tracked = ItemStack.EMPTY;
	private int baseline;

	public ItemTracker() {
		super("item_tracker", "Item Tracker", "Tracks gains and losses of the held item", ModuleCategory.STORAGE, 0.5, 0.9);
	}

	@Override
	protected String computeText(Minecraft mc) {
		ItemStack held = mc.player.getMainHandItem();
		if (held.isEmpty()) {
			tracked = ItemStack.EMPTY;
			return null;
		}
		if (tracked.isEmpty() || !ItemStack.isSameItemSameComponents(tracked, held)) {
			tracked = held.copyWithCount(1);
			baseline = count(mc.player.getInventory(), held);
		}
		int delta = count(mc.player.getInventory(), held) - baseline;
		String sign = delta > 0 ? "+" : "";
		return tracked.getHoverName().getString() + " " + sign + delta;
	}

	private static int count(Inventory inventory, ItemStack target) {
		int total = 0;
		for (int i = 0; i < inventory.getContainerSize(); i++) {
			ItemStack stack = inventory.getItem(i);
			if (!stack.isEmpty() && ItemStack.isSameItemSameComponents(stack, target)) total += stack.getCount();
		}
		return total;
	}
}
