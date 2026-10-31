import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { api } from '@/api/client';
import type { ScreeningListItem } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Art } from '@/components/art';
import { Button } from '@/components/button';
import { IconTile } from '@/components/icon-tile';
import { Screen } from '@/components/screen';
import { Outcomes } from '@/constants/outcomes';
import { Palette, Shadow } from '@/constants/theme';
import { useScreening } from '@/state/screening';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function HistoryScreen() {
  const { t, lang } = useScreening();
  const [items, setItems] = useState<ScreeningListItem[] | null>(null);
  // When the list was fetched, for splitting "this week" from "earlier".
  const [loadedAt, setLoadedAt] = useState(0);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    api
      .listScreenings()
      .then((list) => {
        setItems(list);
        setLoadedAt(Date.now());
      })
      .catch(() => setFailed(true));
  }, []);

  useFocusEffect(load);

  function confirmDelete(id: string, swipeable: SwipeableMethods) {
    Alert.alert(t('history.deleteTitle'), t('history.deleteBody'), [
      { text: t('cancel'), style: 'cancel', onPress: () => swipeable.close() },
      {
        text: t('history.delete'),
        style: 'destructive',
        onPress: () => {
          api
            .deleteScreening(id)
            .then(load)
            .catch(() => setFailed(true));
        },
      },
    ]);
  }

  const recent = items?.filter((i) => loadedAt - new Date(i.created_at).getTime() < WEEK_MS) ?? [];
  const earlier = items?.filter((i) => loadedAt - new Date(i.created_at).getTime() >= WEEK_MS) ?? [];
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';

  function renderItem(item: ScreeningListItem) {
    const created = new Date(item.created_at);
    const date = created.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const time = created.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    const outcome = item.label ? Outcomes[item.label] : Outcomes.unclear;
    const openable = item.status === 'completed';
    const detail = item.label === 'unclear' ? t('history.noResult') : time;

    return (
      <ReanimatedSwipeable
        key={item.screening_id}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        containerStyle={styles.swipeable}
        renderRightActions={(_progress, _translation, swipeable) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('history.delete')}
            onPress={() => confirmDelete(item.screening_id, swipeable)}
            style={styles.delete}>
            <Art name="icon-trash-white" box={18} />
            <AppText size={12} weight="medium" color={Palette.onDark}>
              {t('history.delete')}
            </AppText>
          </Pressable>
        )}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t('history.sub')}
          disabled={!openable}
          onPress={() => router.push({ pathname: '/result', params: { id: item.screening_id } })}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
          <IconTile icon={outcome.listIcon} size={40} iconBox={20} background={outcome.soft} />
          <View style={styles.itemText}>
            <AppText size={15} weight="medium">
              {item.label ? t(`result.badge.${item.label}`) : t('history.inProgress')}
            </AppText>
            <AppText size={12} color={Palette.ink3}>
              {`${date}  ·  ${detail}`}
            </AppText>
          </View>
          {openable && <Art name="icon-chevron" box={18} />}
        </Pressable>
      </ReanimatedSwipeable>
    );
  }

  return (
    <Screen
      title={t('history.title')}
      footer={<Button label={t('history.new')} onPress={() => router.push('/consent')} />}>
      <View style={styles.heading}>
        <AppText size={28} leading={34} weight="medium" tracking={-0.448}>
          {t('history.heading')}
        </AppText>
        <AppText size={15} leading={22} color={Palette.ink2}>
          {t('history.sub')}
        </AppText>
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerText}>
          <AppText size={19} weight="medium" color={Palette.onDark}>
            {t('history.banner')}
          </AppText>
          {items && (
            <AppText size={13} color="#c9aeb5">
              {items.length === 1 ? t('history.countOne') : t('history.count', { n: items.length })}
            </AppText>
          )}
        </View>
        <Image
          source={require('@/assets/figma/hero-heart.png')}
          style={styles.bannerImage}
          contentFit="cover"
        />
      </View>

      {failed ? (
        <View style={styles.center}>
          <AppText color={Palette.ink2}>{t('genericError')}</AppText>
          <Button label={t('retry')} variant="ghost" onPress={load} />
        </View>
      ) : items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.brand} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <AppText color={Palette.ink2}>{t('history.empty')}</AppText>
        </View>
      ) : (
        <>
          {recent.length > 0 && (
            <View style={styles.section}>
              <SectionLabel text={t('history.thisWeek')} />
              {recent.map(renderItem)}
            </View>
          )}
          {earlier.length > 0 && (
            <View style={styles.section}>
              <SectionLabel text={t('history.earlier')} />
              {earlier.map(renderItem)}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <AppText size={12} weight="medium" color={Palette.ink3} tracking={0.72}>
      {text.toLocaleUpperCase()}
    </AppText>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 96,
    paddingLeft: 18,
    paddingRight: 4,
    borderRadius: 23,
    backgroundColor: Palette.night,
  },
  bannerText: {
    flex: 1,
    gap: 4,
  },
  bannerImage: {
    width: 90,
    height: 90,
    borderRadius: 22,
  },
  center: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  section: {
    gap: 8,
  },
  swipeable: {
    overflow: 'visible',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 0.65,
    borderColor: Palette.line,
    backgroundColor: Palette.surface,
    boxShadow: Shadow.card,
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  delete: {
    width: 76,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 18,
    backgroundColor: Palette.brand,
  },
});
