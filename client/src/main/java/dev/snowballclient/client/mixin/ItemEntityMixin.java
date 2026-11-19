package dev.snowballclient.client.mixin;

import com.llamalad7.mixinextras.injector.ModifyReturnValue;
import dev.snowballclient.client.module.ModuleRegistry;
import net.minecraft.world.entity.item.ItemEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

@Mixin(ItemEntity.class)
public abstract class ItemEntityMixin {
	@ModifyReturnValue(method = "getVisualRotationYInDegrees", at = @At("RETURN"))
	private float snowballclient$itemPhysics(float vanilla) {
		return ModuleRegistry.ITEM_PHYSICS == null ? vanilla : ModuleRegistry.ITEM_PHYSICS.rotation(vanilla);
	}
}
