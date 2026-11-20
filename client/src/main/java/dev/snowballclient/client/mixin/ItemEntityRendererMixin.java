package dev.snowballclient.client.mixin;

//? if >=26.1 {
import dev.snowballclient.client.module.ModuleRegistry;
import net.minecraft.client.renderer.entity.ItemEntityRenderer;
import net.minecraft.client.renderer.entity.state.ItemEntityRenderState;
import net.minecraft.world.entity.item.ItemEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ItemEntityRenderer.class)
public abstract class ItemEntityRendererMixin {
	@Inject(method = "render", at = @At("TAIL"))
	private void snowballclient$itemPhysics(ItemEntity entity, ItemEntityRenderState state, float partialTick, CallbackInfo ci) {
		if (ModuleRegistry.ITEM_PHYSICS != null) state.bobOffset = ModuleRegistry.ITEM_PHYSICS.bob(state.bobOffset);
	}
}
//?}
