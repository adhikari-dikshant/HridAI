import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { api, type UploadReportInput } from '@/api/client';
import type { ReportResponse } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Art } from '@/components/art';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconTile } from '@/components/icon-tile';
import { Note } from '@/components/note';
import { Screen } from '@/components/screen';
import { SessionLost } from '@/components/session-lost';
import { StepProgress } from '@/components/step-progress';
import { Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

const MAX_BYTES = 10 * 1024 * 1024;

type Report = {
  key: string;
  name: string;
  status: 'reading' | 'ready' | 'failed';
  error?: string;
  response?: ReportResponse;
};

export default function ReportsScreen() {
  const { t, lang, session } = useScreening();
  const [reports, setReports] = useState<Report[]>([]);

  if (!session) return <SessionLost />;
  const screeningId = session.screening_id;
  const reading = reports.some((r) => r.status === 'reading');

  function update(key: string, patch: Partial<Report>) {
    setReports((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function upload(input: UploadReportInput, size: number | undefined) {
    const key = `${Date.now()}`;
    if (size !== undefined && size > MAX_BYTES) {
      setReports((list) => [
        ...list,
        { key, name: input.name, status: 'failed', error: t('reports.tooBig') },
      ]);
      return;
    }

    setReports((list) => [...list, { key, name: input.name, status: 'reading' }]);
    try {
      const response = await api.uploadReport(screeningId, input);
      update(key, { status: 'ready', response });
    } catch {
      update(key, { status: 'failed', error: t('reports.failed') });
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    await upload(
      {
        uri: asset.uri,
        name: asset.fileName ?? 'report.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      },
      asset.fileSize
    );
  }

  async function chooseFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await upload(
      { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf' },
      asset.size
    );
  }

  return (
    <Screen
      title={t('reports.title')}
      gap={12}
      footer={
        <>
          <Button
            label={t('reports.analyze')}
            disabled={reading}
            onPress={() => router.push('/analyzing')}
          />
          <Button
            label={t('reports.skip')}
            variant="ghost"
            disabled={reading}
            onPress={() => router.push('/analyzing')}
          />
        </>
      }>
      <StepProgress step={4} name={t('reports.title')} />

      <View style={styles.heading}>
        <AppText size={28} leading={34} weight="medium" tracking={-0.448}>
          {t('reports.heading')}
        </AppText>
        <AppText size={15} leading={22} color={Palette.ink2}>
          {t('reports.sub')}
        </AppText>
      </View>

      <View style={styles.dropzone}>
        <View style={styles.illustration}>
          <Art name="report-illustration" />
        </View>
        <View style={styles.dropzoneText}>
          <AppText size={16} weight="medium">
            {t('reports.upload')}
          </AppText>
          <AppText size={13} color={Palette.ink3}>
            {t('reports.limits')}
          </AppText>
        </View>
        <View style={styles.actions}>
          <PickButton icon="icon-camera" label={t('reports.camera')} onPress={takePhoto} />
          <PickButton icon="icon-file-small" label={t('reports.file')} onPress={chooseFile} />
        </View>
      </View>

      {reports.map((report) => (
        <Card key={report.key}>
          <View style={styles.reportRow}>
            <IconTile icon="icon-file" size={40} iconBox={20} />
            <View style={styles.flex}>
              <AppText size={15} weight="medium" numberOfLines={1}>
                {report.name}
              </AppText>
              <AppText
                size={12}
                color={
                  report.status === 'ready'
                    ? Palette.ok
                    : report.status === 'failed'
                      ? Palette.brand
                      : Palette.ink3
                }>
                {report.status === 'ready'
                  ? t('reports.ready')
                  : report.status === 'failed'
                    ? report.error
                    : t('reports.reading')}
              </AppText>
            </View>
            {report.status === 'reading' ? (
              <ActivityIndicator color={Palette.ink3} />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('reports.remove')}
                hitSlop={8}
                onPress={() => setReports((list) => list.filter((r) => r.key !== report.key))}
                style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
                <Art name="icon-close" box={16} />
              </Pressable>
            )}
          </View>
          {report.response && (
            <View style={styles.summary}>
              <AppText size={11} weight="medium" color={Palette.ink3} tracking={0.66}>
                {t('reports.summary').toLocaleUpperCase()}
              </AppText>
              <AppText size={14} leading={20}>
                {lang === 'hi' ? report.response.summary_hi : report.response.summary_en}
              </AppText>
            </View>
          )}
        </Card>
      ))}

      <Note tone="plain" text={t('reports.note')} />
    </Screen>
  );
}

function PickButton({
  icon,
  label,
  onPress,
}: {
  icon: 'icon-camera' | 'icon-file-small';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pick, pressed && styles.pressed]}>
      <Art name={icon} box={18} />
      <AppText size={14} weight="medium">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: 8,
  },
  dropzone: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1.25,
    borderStyle: 'dashed',
    borderColor: Palette.ink3,
    backgroundColor: Palette.surface,
  },
  illustration: {
    width: 48,
    height: 48,
    borderRadius: 14.4,
    overflow: 'hidden',
    backgroundColor: Palette.brandSoft,
  },
  dropzoneText: {
    alignItems: 'center',
    gap: 2,
  },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  pick: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    backgroundColor: Palette.surface2,
  },
  pressed: {
    opacity: 0.6,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  remove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface2,
  },
  summary: {
    gap: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Palette.bg,
  },
});
