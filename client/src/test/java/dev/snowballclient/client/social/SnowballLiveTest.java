package dev.snowballclient.client.social;

import dev.snowballclient.client.emote.Emotes;
import dev.snowballclient.client.emote.Pose;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class SnowballLiveTest {
	private static final String ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
	private static final UUID PLAYER = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
	private String previousApiUrl;

	@BeforeEach
	void configureCommunityBackend() {
		previousApiUrl = System.getProperty("lucid.apiUrl");
		System.setProperty("lucid.apiUrl", "https://community.test");
	}

	@AfterEach
	void restoreCommunityBackend() {
		if (previousApiUrl == null) System.clearProperty("lucid.apiUrl");
		else System.setProperty("lucid.apiUrl", previousApiUrl);
	}

	@Test
	void backendMessagesBecomeEmotesAndCapes() {
		long now = System.currentTimeMillis();
		Emotes.setShowOthers(true);
		SnowballLive.receive("{\"type\":\"emote\",\"uuid\":\"" + ID + "\",\"id\":\"cheer\",\"at\":1}", now);
		assertTrue(Emotes.pose(PLAYER, now + 500, new Pose()));
		SnowballLive.receive("{\"type\":\"stop\",\"uuid\":\"" + ID + "\"}", now);
		assertFalse(Emotes.pose(PLAYER, now + 600, new Pose()));

		SnowballLive.receive("{\"type\":\"looks\",\"uuid\":\"" + ID + "\",\"looks\":{\"cape\":\"custom\",\"v\":4}}", now);
		assertEquals("custom:4", Looks.cape(PLAYER));
		SnowballLive.receive("{\"type\":\"looks\",\"uuid\":\"" + ID + "\",\"looks\":null}", now);
		assertNull(Looks.cape(PLAYER));
		// Nonsense is ignored.
		SnowballLive.receive("not json", now);
		SnowballLive.receive("{\"type\":\"emote\",\"uuid\":\"short\",\"id\":\"wave\"}", now);
	}

	@Test
	void badgesComeAndGoOverTheLiveChannel() {
		long now = System.currentTimeMillis();
		SnowballLive.receive("{\"type\":\"rank\",\"uuid\":\"" + ID + "\",\"rank\":\"bug_hunter\"}", now);
		assertEquals(Rank.BUG_HUNTER, SnowballPlayers.rank(PLAYER));
		SnowballLive.receive("{\"type\":\"gone\",\"uuid\":\"" + ID + "\"}", now);
		assertFalse(SnowballPlayers.isSnowball(PLAYER));
	}

	@Test
	void aPlayerWhoLeavesSnowballGetsTheirOwnCapeBack() {
		long now = System.currentTimeMillis();
		Looks.setShowOthers(true);
		SnowballLive.receive("{\"type\":\"looks\",\"uuid\":\"" + ID + "\",\"looks\":{\"cape\":\"aurora\"}}", now);
		assertEquals("aurora", Looks.cape(PLAYER));
		SnowballLive.receive("{\"type\":\"gone\",\"uuid\":\"" + ID + "\"}", now);
		assertNull(Looks.cape(PLAYER), "a Snowball cape would otherwise keep covering their real one");
	}

	@Test
	void offlineBuildHidesCommunityCapes() {
		System.clearProperty("lucid.apiUrl");
		SnowballLive.receive("{\"type\":\"looks\",\"uuid\":\"" + ID + "\",\"looks\":{\"cape\":\"aurora\"}}", System.currentTimeMillis());
		assertFalse(RankLookup.isConfigured());
		assertNull(Looks.cape(PLAYER));
	}
}
